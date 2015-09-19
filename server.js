// Moduł serwera HTTP
// (wbudowany w node)
var http = require('http');

// Moduł parsowania ścieżek do plików/katalogów
// (wbudowany w node)
var path = require('path');

// Moduł parsowania adresów URL
// (wbudowany w node)
var url = require('url');

// Moduł systemu plików
// (wbudowany w node)
var fs = require('fs');

// Moduł serwera WebSockets
// (moduł zainstalowany poprzez NPM)
var ws = require('websockets');

// Moduł do generowania unikalnych id
// (moduł zainstalowany poprzez NPM)
var uuid = require('uuid');

// Nasz lokalny moduł, który współdzielimy z 
// klientem frontendowym
var consts = require('./consts');

// Możemy użyć dowolnego portu i hosta, 
// oczywiście zakładając, że są one wolne na
// naszej maszynie.
var PORT = 8080,
        HOST = 'localhost';

var httpServer, wsServer;

// Lista klientów, połączonych z naszym serwerem.
var sockets = {};

// Prosta funkcja pomocnicza dla określenia 
// Content-Type danego pliku 
function getContentType(name) {
    switch (path.extname(name)) {
        case '.html':
        case '.htm':
            return 'text/html';
        case '.css':
            return 'text/css';
        case '.js':
            return 'text/javascript';
        case '.png':
            return 'image/png';
        default:
            return 'text/plain';
    }
}

// Funkcja createServer w module HTTP tworzy
// nam nowy serwer, będziemy go wykorzystywać 
// głównie do wysyłania plików, żądanych 
// przez klienta
httpServer = http.createServer(function (req, res) {
    // Początkową ścieżkę dla każdego pliku, 
    // ustawiamy na lokację naszej aplikacji.
    var name = __dirname;

    // Sprawdzamy czy jesteśmy na stronie 
    // głównej (/), jeżeli tak, to powinniśmy 
    // w odpowiedzi wysłać plik index.html.
    if (/^\/$/.test(req.url)) {
        name += '/index.html';
    } else {
        // moduł url – parsuje ciąg znaków URL
        name += url.parse(req.url).pathname;
    }

    // Przed odczytaniem pliku sprawdzamy, czy on 
    // istnieje, jeśli tak, to wysyłamy w odpowiedzi 
    // jego zawartość wraz z odpowiednim
    // Content-Type. Jeżeli jednak nie znajdziemy 
    // pliku na dysku, musimy odpowiedzieć 
    // błędem 404.
    fs.exists(name, function (exists) {
        if (exists) {
            res.writeHead(200, {
                'Content-Type': getContentType(name)
            });
            fs.readFile(name, function (err, data) {
                if (err)
                    throw (err);
                res.end(data);
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    });
});

// Wysyła wiadomość do wszystkich klientów, oprócz
// jednego, którego chcemy zignorować.
// Jeżeli serwer przekazuje wiadomość od jednego 
// klienta do pozostałych klientów, to ważnym jest,
// aby wiadomości tej nie wysyłać niepotrzebnie
// z powrotem do nadawcy, dlatego też nadawca
// wiadomości jest ignorowany. 
function broadcast(data, ignore_id) {
    if (typeof data !== 'string') {
        data = JSON.stringify(data);
    }

    for (var id in sockets) {
        if (id !== ignore_id) {
            sockets[ id ].send(data);
        }
    }
}

// W przypadku serwera WebSocket, chcemy by 
// nasłuchiwał na tym samym porcie i hoście co 
// serwer HTTP, dlatego też nie będziemy 
// bezpośrednio nasłuchiwać poprzez wywołanie 
// metody listen(), lecz przekażemy do serwera 
// WebSocket referencję do serwera http.
wsServer = ws.createServer({
    server: httpServer
});

// Jako pierwszy argument podajemy numer portu, pod
// jakim ma zostać uruchomiony serwer. 
// Dopiero na drugim miejscu znajduje się host. 
// Jest to trochę nieintuicyjne, biorąc po uwagę 
// fakt, iż w postaci URL dane te są podawane w 
// odwrotnej kolejności.
wsServer.on('connect', function (socket) {
    // Zapamiętujemy referencję do danego klienta.
    var id = uuid.v1();
    sockets[ id ] = socket;

    console.log('New socket: %s', id);

    // Przypisujemy funkcję na zdarzenie otrzymania 
    // wiadomości z gniazda. W zależności od typu 
    // wiadomości, jaka przyjdzie, wykonujemy  
    // odpowiednią akcję w odpowiedzi.
    socket.on('message', function (data) {
        message = JSON.parse(data);
        switch (message.type) {
            case consts.JOIN:
                var nick = message.body;
                console.log('Join: %s', nick);
                broadcast({
                    type: consts.SYS_MSG,
                    body: {
                        text: nick + ' dołączył do pokoju'
                    }
                }, id);
                break;
            case consts.USR_MSG:
                broadcast(data, id);
                break;
        }
    });

    socket.on('close', function () {
        console.log('Socket closed: %s', id);
        delete sockets[id];
    });

}).listen(PORT, HOST, function () {
    console.log('Server running on http://%s:%d', HOST, PORT);
});
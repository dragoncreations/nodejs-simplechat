// Kilka użytecznych stałych 
var ENTER = 13;
var ESC = 27;
var INP_SLCT = 'footer input';
var LST_SLCT = 'ul#messages';

// Element DOM pola tekstowego do wprowadzania 
// wiadomości oraz element listy wiadomości 
var inputEl, msgListEl;

// Główny obiekt naszej aplikacji 
var app = {
    me: location.search.match(/^\?nick=(.*)/i)[1],
    connecting: false,
    socket: null
};

// Funkcja do wypisywania wiadomości w liście 
app.writeMessage = function (message) {
    var type = message.type || consts.USR_MSG,
            text = message.body.text || '',
            from = message.body.from || '';

    var li = document.createElement('li'),
            span = document.createElement('span'),
            div = document.createElement('div');

    li.appendChild(span);
    li.appendChild(div);

    var from_el = document.createTextNode(from),
            text_el = document.createTextNode(text);

    // W przypadku wiadomości systemowych, nie 
    // otrzymamy zdefiniowanego autora wiadomości. 
    if (from) {
        span.appendChild(from_el);
    }

    div.appendChild(text_el);
    msgListEl.appendChild(li);

    // Przemieszczamy scrollbar na sam dół listy 
    // wiadomości, poprzez przypisanie do 
    // właściwości scrollTop nowej całkowitej 
    // wysokości listy wiadomości (scrollHeight 
    // nie jest równy wysokości elementu, gdyż 
    // bierze pod uwagę część elementu, która 
    // jest niewidoczna, gdyż znajduje się pod 
    // zawinięciem). 
    msgListEl.scrollTop = msgListEl.scrollHeight;
};

// Funkcja pomocniczna wysyła wiadomość na 
// serwer, następnie dodaje wiadomość do listy 
// wiadomości. 
app.sendMessage = function (text) {
    // Przyjmijmy, iż każdą wiadomość, jaką wyślemy 
    // na serwer, będziemy trzymać w obiekcie z 
    // dwoma właściwościami. 
    // – type – typ wiadomości, jaka ma zostać 
    //          wysłana 
    // – body – treść wiadomości będący ciągiem 
    //          znaków, bądź innym obiektem. 
    var message = {
        type: consts.USR_MSG,
        body: {
            text: text,
            from: this.me
        }
    };

    // Przed wysłaniem wiadomości na serwer, 
    // musimy skonwertować ją do postaci ciągu 
    // znaków w formacie JSON. Oczywiście po 
    // socketach możemy wysłać dowolny ciąg 
    // znaków, jednak zdecydowaliśmy się na format 
    // JSON, by nie wymyślać koła na nowo. 
    this.socket.send(JSON.stringify(message));

    this.writeMessage(message);
};

// Inicjuje aplikację klienta po załadowaniu 
// drzewa DOM. Wyszukuje elementy DOM pola 
// tekstowego i listy wiadomości, po czym 
// przypisuje zdarzenie na pole tekstowe w celu 
// obsługi klawisza enter (moment zakończenia 
// wprowadzania wiadomości).
app.init = function () {
    inputEl = document.querySelector(INP_SLCT);
    msgListEl = document.querySelector(LST_SLCT);

    inputEl.addEventListener('keyup', function (e) {
        switch (e.keyCode) {
            case ENTER:
                e.preventDefault();
                app.sendMessage(this.value);
                this.value = '';
                break;
            case ESC:
                e.preventDefault();
                this.value = '';
        }
    });

    // Ustanawiamy połączenie gniazda 
    // z serwerem WebSocket
    this.connect();
};

// Funkcja, którą wykorzystamy do połączenia 
// (bądź ponownego połączenia po zerwaniu 
// połączenia) się z serwerem
app.connect = function () {
    var host = location.host;
    this.socket = new WebSocket('ws://' + host);
    this.connecting = true;

    // WebSocket obsługuje cztery typy zdarzeń:
    //
    // * open – nawiązanie połączenia0
    // * message – przychodząca wiadomość 
    //             z serwera
    // * close – zamknięcie gniazda
    // * error – wystąpienie błędu (np. gdy nie 
    //           można się połączyć z serwerem)
    this.socket.addEventListener('open', function () {
        app.connecting = false;

        // Po nawiązaniu połączenia 
        // wysyłamy nick na serwer,
        // by poinformować inne osoby obecne 
        // w pokoju o fakcie połączenia się 
        // nowego użytkownika.
        app.socket.send(JSON.stringify({
            type: consts.JOIN,
            body: app.me
        }));

        // Domyślnie pole tekstowe jest 
        // wyłączone, by użytkownik nie 
        // próbował wysłać wiadomości 
        // na serwer przed ustanowieniem 
        // połączenia.
        inputEl.removeAttribute('disabled');
    });

    this.socket.addEventListener('message', function (e) {
        var message = JSON.parse(e.data);
        switch (message.type) {
            case consts.USR_MSG:
            case consts.SYS_MSG:
                app.writeMessage(message);
                break;
        }
    });

    this.socket.addEventListener('close', function () {
        console.log('CLOSE', arguments);
        app.reconnect();
    });

    this.socket.addEventListener('error', function () {
        console.log('ERROR', arguments);
        app.connecting = false;
    });
};

// Ponownie nawiązuje połączenie z serwerem
// w sytuacji, gdy zostanie ono zerwane.
app.reconnect = function(){
    if ( !app.connecting ) {
        // Czyścimy gniazdo.
        app.socket.close();
        app.socket.removeEventListener('open');
        app.socket.removeEventListener('message');
        app.socket.removeEventListener('close');
        app.socket.removeEventListener('error');
        setTimeout(function(){
            app.connect();
        }, 1000);
    }
};
(function(){
    var consts = {
        USR_MSG : 1,
        SYS_MSG : 2,
        JOIN : 3
    };
    if ( typeof module !== 'undefined' && typeof process !== 'undefined' ) {
        module.exports = consts;
    } else {
        window.consts = consts;
    }
})();
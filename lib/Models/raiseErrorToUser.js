'use strict';

/*global require*/

var TerriaError = require('../Core/TerriaError');

var raiseErrorToUser = function(terria, error) {
    if (error instanceof TerriaError) {
        if (!error.raisedToUser) {
            error.raisedToUser = true;
            terria.error.raiseEvent(error);
        }
    } else {
        terria.error.raiseEvent(new TerriaError({
            sender: undefined,
            title: 'Errore',
            message: '\
<p>'+terria.appName+' ha avuto un errore. Si prega di riportare quanto accaduto scrivendo a <a href="mailto:'+terria.supportEmail+'">'+terria.supportEmail+'</a>.  \
Seguono alcuni dettagli:</p>\
<p><pre>' + error.toString() + '</pre></p>'
        }));
    }
};

module.exports = raiseErrorToUser;
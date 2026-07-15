# -*- coding: utf-8 -*-
{
    "name": "Voz a texto",
    "summary": "Graba instrucciones de voz y hace su transcripción",
    "description": "Grabación de audio y transcripción.",
    "author": "nancy",
    "website": "https://github.com/Nancy2050/",
    "category": "Productivity",
    "version": "19.0.1.0.0",
    "depends": ["base", "web", "mail"],
    "data": [
        "security/ir.model.access.csv",
        "views/views.xml",
    ],
    "installable": True,
    "application": True,
    "assets": {
        "web.assets_backend": [
            "voice_to_text/static/src/js/voice_recorder_systray.js",
            "voice_to_text/static/src/xml/voice_recorder_systray.xml",
            "voice_to_text/static/src/scss/voice_recorder.scss",
        ],
    },
}

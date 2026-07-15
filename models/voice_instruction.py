import html

from odoo import api, fields, models


class VoiceInstruction(models.Model):
    _name = "voice.instruction"
    _description = "Instrucción de voz"
    _order = "create_date desc"

    name = fields.Char(string="Título", compute="_compute_name", store=True)
    transcript = fields.Text(string="Texto transcrito", required=True)
    audio = fields.Binary(string="Archivo de audio", required=True, attachment=True)
    audio_filename = fields.Char(string="Nombre del archivo", required=True)
    audio_mimetype = fields.Char(string="Tipo de archivo", readonly=True)
    duration = fields.Float(string="Duración (segundos)", readonly=True)
    user_id = fields.Many2one(
        "res.users", string="Creado por", required=True,
        default=lambda self: self.env.user, readonly=True, index=True,
    )
    audio_player = fields.Html(
        string="Reproductor", compute="_compute_audio_player", sanitize=False,
    )

    @api.depends("transcript", "create_date")
    def _compute_name(self):
        for record in self:
            text = " ".join((record.transcript or "").split())
            record.name = text[:70] or "Nueva instrucción de voz"

    def _compute_audio_player(self):
        for record in self:
            if not record.id or not record.audio:
                record.audio_player = False
                continue
            source = f"/web/content/voice.instruction/{record.id}/audio?download=false"
            mime = html.escape(record.audio_mimetype or "audio/webm", quote=True)
            record.audio_player = (
                '<audio controls preload="metadata" style="width:100%">'
                f'<source src="{source}" type="{mime}">'
                "Tu navegador no puede reproducir este audio."
                "</audio>"
            )

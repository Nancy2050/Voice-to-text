import html

from odoo import api, fields, models


class VoiceInstruction(models.Model):
    _name = "voice.instruction"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _description = "Instrucción de voz"
    _order = "create_date desc"

    name = fields.Char(string="Título", compute="_compute_name", store=True)
    transcript = fields.Text(string="Texto transcrito", required=True)
    audio = fields.Binary(string="Archivo de audio", required=True, attachment=True)
    audio_filename = fields.Char(string="Nombre del archivo", required=True)
    audio_mimetype = fields.Char(string="Tipo de archivo", readonly=True)
    audio_attachment_id = fields.Many2one(
        "ir.attachment", string="Adjunto de audio", readonly=True, copy=False,
        ondelete="set null",
    )
    audio_player = fields.Html(
        string="Reproductor", compute="_compute_audio_player", sanitize=False,
    )
    duration = fields.Float(string="Duración (segundos)", readonly=True)
    user_id = fields.Many2one(
        "res.users", string="Creado por", required=True,
        default=lambda self: self.env.user, readonly=True, index=True,
    )
    @api.depends("transcript", "create_date")
    def _compute_name(self):
        for record in self:
            text = " ".join((record.transcript or "").split())
            record.name = text[:70] or "Nueva instrucción de voz"

    @api.depends("audio_attachment_id", "audio_mimetype")
    def _compute_audio_player(self):
        for record in self:
            if not record.audio_attachment_id:
                record.audio_player = False
                continue
            source = f"/web/content/{record.audio_attachment_id.id}?download=false"
            mimetype = html.escape(record.audio_mimetype or "audio/webm", quote=True)
            record.audio_player = (
                '<audio controls preload="metadata" style="display:block;width:100%">'
                f'<source src="{source}" type="{mimetype}">'
                "Tu navegador no puede reproducir este audio."
                "</audio>"
            )

    def _create_chatter_audio_attachment(self, audio=None):
        """Create the regular attachment used by both chatter and the player."""
        Attachment = self.env["ir.attachment"].sudo()
        for record in self:
            if record.audio_attachment_id or not (audio or record.audio):
                continue
            attachment = Attachment.create({
                "name": record.audio_filename or "audio.webm",
                "datas": audio or record.audio,
                "mimetype": record.audio_mimetype or "audio/webm",
                "res_model": record._name,
                "res_id": record.id,
            })
            record.sudo().audio_attachment_id = attachment

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for record, values in zip(records, vals_list):
            record._create_chatter_audio_attachment(values.get("audio"))
        return records

    def write(self, vals):
        result = super().write(vals)
        if "audio" in vals:
            for record in self:
                if record.audio_attachment_id:
                    record.audio_attachment_id.sudo().write({
                        "name": record.audio_filename or "audio.webm",
                        "datas": vals["audio"],
                        "mimetype": record.audio_mimetype or "audio/webm",
                    })
                else:
                    record._create_chatter_audio_attachment(vals["audio"])
        return result

    @api.model
    def _ensure_chatter_audio_attachments(self):
        """Backfill audios recorded before chatter attachments were introduced."""
        records = self.sudo().search([
            ("audio", "!=", False),
            ("audio_attachment_id", "=", False),
        ])
        records._create_chatter_audio_attachment()

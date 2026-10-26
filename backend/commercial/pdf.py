from io import BytesIO
from xml.sax.saxutils import escape

from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import DeliveryNote, Invoice, Quote, SalesOrder


DOCUMENT_TITLES = {
    Quote: "DEVIS",
    SalesOrder: "BON DE COMMANDE",
    DeliveryNote: "BON DE LIVRAISON",
    Invoice: "FACTURE",
}


def document_pdf_response(document):
    output = BytesIO()
    styles = getSampleStyleSheet()
    green = colors.HexColor("#13795B")
    muted = colors.HexColor("#667773")
    title = DOCUMENT_TITLES[type(document)]
    pdf = SimpleDocTemplate(output, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm,
                            topMargin=16*mm, bottomMargin=16*mm, title=f"{title} {document.reference}")
    right = ParagraphStyle("right", parent=styles["Normal"], alignment=TA_RIGHT, leading=16)
    story = [
        Table([[Paragraph("<b>FLEETTRANSPORT PRO</b>", styles["Title"]),
                Paragraph(f"<font color='#13795B'><b>{title}</b></font><br/><b>{document.reference}</b>", right)]],
              colWidths=[100*mm, 58*mm]),
        Spacer(1, 8*mm),
        Table([
            ["Societe emettrice", document.company.legal_name or document.company.name, "Date", document.document_date.strftime("%d/%m/%Y")],
            ["Agence", document.agency.name if document.agency else "-", "Devise", document.currency],
            ["Client", document.customer.name, "Statut", document.get_status_display()],
            ["ICE client", document.customer.ice or "-", "Reference", document.reference],
        ], colWidths=[34*mm, 63*mm, 25*mm, 36*mm], style=TableStyle([
            ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#F0F5F3")), ("BACKGROUND", (2,0), (2,-1), colors.HexColor("#F0F5F3")),
            ("TEXTCOLOR", (0,0), (-1,-1), colors.HexColor("#14211F")), ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
            ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"), ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 9), ("GRID", (0,0), (-1,-1), .4, colors.HexColor("#DFE8E4")),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
        ])),
        Spacer(1, 8*mm),
    ]
    rows = [["Prestation / trajet", "Quantite", "Prix unit. HT", "TVA", "Total HT"]]
    for line in document.lines.all():
        rows.append([Paragraph(escape(line.description), styles["BodyText"]), f"{line.quantity:g}",
                     f"{line.unit_price:,.2f}", f"{line.tax_rate:g}%", f"{line.total_excl_tax:,.2f}"])
    lines_table = Table(rows, repeatRows=1, colWidths=[72*mm, 19*mm, 27*mm, 17*mm, 28*mm])
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), green), ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"), ("ALIGN", (1,1), (-1,-1), "RIGHT"),
        ("FONTSIZE", (0,0), (-1,-1), 9), ("GRID", (0,0), (-1,-1), .4, colors.HexColor("#DFE8E4")),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    story.extend([lines_table, Spacer(1, 7*mm)])
    totals = Table([
        ["Total HT", f"{document.total_excl_tax:,.2f} {document.currency}"],
        ["TVA", f"{document.tax_total:,.2f} {document.currency}"],
        ["TOTAL TTC", f"{document.total_incl_tax:,.2f} {document.currency}"],
    ], colWidths=[36*mm, 42*mm], hAlign="RIGHT")
    totals.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), "Helvetica-Bold"), ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("BACKGROUND", (0,2), (-1,2), colors.HexColor("#E7F5EF")), ("TEXTCOLOR", (0,2), (-1,2), green),
        ("LINEABOVE", (0,0), (-1,0), .5, muted), ("FONTSIZE", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    story.append(totals)
    if document.notes:
        story.extend([Spacer(1, 9*mm), Paragraph("<b>Observations</b>", styles["Heading4"]),
                      Paragraph(escape(document.notes), styles["BodyText"])])
    story.extend([Spacer(1, 15*mm), Paragraph("Document genere par FleetTransport Pro", ParagraphStyle(
        "footer", parent=styles["Normal"], textColor=muted, fontSize=8, alignment=TA_RIGHT))])
    pdf.build(story)
    response = HttpResponse(output.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{document.reference}.pdf"'
    return response

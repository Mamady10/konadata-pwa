# Kit de prospection KonaData

Outils pour transformer l'intérêt en utilisateurs réels, par la preuve et le contact direct. Ce kit complète la [campagne de communication](../campagne/PLAN-DE-COMMUNICATION.md) et les [exemples de documents](../exemples/README.md).

| Fichier | Contenu | Usage |
|---|---|---|
| [PLAN-30-JOURS.md](PLAN-30-JOURS.md) | Plan jour par jour du 5 octobre au 3 novembre 2026, objectifs, tableau de suivi des contacts | Votre feuille de route |
| [MESSAGES-WHATSAPP.md](MESSAGES-WHATSAPP.md) | Messages prêts à copier : groupe, messages privés par profil, relances, réponses aux objections, statuts | À copier dans WhatsApp |
| `programme-pilote.pdf` | Fiche « Programme pilote : 30 jours accompagnés » (2 pages A4) | Envoi par e-mail, impression |
| `programme-pilote-page-1.png`, `-page-2.png` | Les deux pages de la fiche en image | Partage dans WhatsApp (les images s'affichent directement) |
| `KONADATA-PRESENTATION-PARTENAIRES.pptx` | Présentation de 15 diapositives, avec notes de l'orateur | Organisations professionnelles, universités, rendez-vous |

## Le programme pilote

Il **s'ajoute** à l'offre de lancement (12 mois gratuits pour les écoles, 6 mois pour les ONG, le BTP et les PME) : installation, formation et suivi pendant 30 jours, dans la limite de 10 organisations par secteur. Il ne remplace pas la période gratuite et ne doit pas être présenté comme un « essai de 30 jours ».

## Régénérer la fiche et la présentation

```bash
node scripts/marketing/build-prospection-kit.mjs            # tout
node scripts/marketing/build-prospection-kit.mjs --only=fiche
node scripts/marketing/build-prospection-kit.mjs --only=deck
```

Les textes, le nombre de places (`PILOT_PLACES`) et les tarifs se modifient en tête du script. Les tarifs doivent rester alignés sur `lib/marketing/landing-content.ts`, et les contacts sur `scripts/marketing/campaign-content.mjs`.

/* ------------------------------------------------------------------
   Tarifas de lista de WhatsApp Business Platform (Meta), en USD por
   mensaje entregado. Vigentes desde el 1 de octubre de 2026.
   Meta solo puede cambiarlas el 1 de ene, abr, jul u oct, con al menos
   un mes de aviso: revisa developers.facebook.com/documentation/
   business-messaging/whatsapp/pricing antes de cada trimestre.

   Formato: id: [nombre, marketing, utilidad/autenticación/servicio]
------------------------------------------------------------------- */
window.WA_RATES = (function () {
  // Mercados con tarifa propia
  const OWN = {
    AR: ["Argentina", 0.0618, 0.0260],
    BD: ["Bangladés", 0.0732, 0.0037],
    BR: ["Brasil", 0.0625, 0.0068],
    CL: ["Chile", 0.0889, 0.0200],
    CO: ["Colombia", 0.0125, 0.0008],
    EG: ["Egipto", 0.0644, 0.0036],
    FR: ["Francia", 0.0859, 0.0300],
    DE: ["Alemania", 0.1365, 0.0550],
    HK: ["Hong Kong", 0.0732, 0.0260],
    HU: ["Hungría", 0.0860, 0.0350],
    IN: ["India", 0.0118, 0.0014],
    ID: ["Indonesia", 0.0411, 0.0250],
    IQ: ["Irak", 0.0341, 0.0079],
    IL: ["Israel", 0.0353, 0.0053],
    IT: ["Italia", 0.0795, 0.0300],
    KZ: ["Kazajistán", 0.0604, 0.0180],
    KW: ["Kuwait", 0.0792, 0.0440],
    MY: ["Malasia", 0.0860, 0.0140],
    MX: ["México", 0.0397, 0.0085],
    MA: ["Marruecos", 0.0414, 0.0230],
    NP: ["Nepal", 0.0732, 0.0034],
    NL: ["Países Bajos", 0.1597, 0.0500],
    NG: ["Nigeria", 0.0516, 0.0067],
    OM: ["Omán", 0.0341, 0.0247],
    PK: ["Pakistán", 0.0473, 0.0150],
    PE: ["Perú", 0.0703, 0.0300],
    PL: ["Polonia", 0.0366, 0.0122],
    QA: ["Catar", 0.0341, 0.0120],
    RO: ["Rumanía", 0.0860, 0.0290],
    RU: ["Rusia", 0.0802, 0.0400],
    SA: ["Arabia Saudita", 0.0576, 0.0107],
    SG: ["Singapur", 0.0732, 0.0160],
    ZA: ["Sudáfrica", 0.0379, 0.0095],
    ES: ["España", 0.0707, 0.0200],
    LK: ["Sri Lanka", 0.0732, 0.0020],
    TR: ["Turquía", 0.0109, 0.0009],
    UA: ["Ucrania", 0.0860, 0.0298],
    AE: ["Emiratos Árabes Unidos", 0.0576, 0.0157],
    GB: ["Reino Unido", 0.0635, 0.0220]
  };

  // Regiones: tarifa compartida por varios países
  const REGIONS = {
    NA:   ["Norteamérica", 0.0250, 0.0034],
    LATAM:["Resto de Latinoamérica", 0.0740, 0.0113],
    WEU:  ["Resto de Europa Occidental", 0.0592, 0.0171],
    CEE:  ["Resto de Europa Central y del Este", 0.0860, 0.0212],
    ME:   ["Resto de Oriente Medio", 0.0392, 0.0091],
    APAC: ["Resto de Asia-Pacífico", 0.0842, 0.0113],
    AFR:  ["Resto de África", 0.0225, 0.0040],
    OTHER:["Otros países", 0.0604, 0.0077]
  };

  const MEMBERS = {
    NA: ["Estados Unidos", "Canadá"],
    LATAM: ["Bolivia", "Costa Rica", "República Dominicana", "Ecuador", "El Salvador", "Guatemala", "Haití", "Honduras", "Jamaica", "Nicaragua", "Panamá", "Paraguay", "Puerto Rico", "Uruguay", "Venezuela"],
    WEU: ["Austria", "Bélgica", "Dinamarca", "Finlandia", "Irlanda", "Noruega", "Portugal", "Suecia", "Suiza"],
    CEE: ["Albania", "Armenia", "Azerbaiyán", "Bielorrusia", "Bulgaria", "Croacia", "República Checa", "Georgia", "Grecia", "Letonia", "Lituania", "Moldavia", "Macedonia del Norte", "Serbia", "Eslovaquia", "Eslovenia"],
    ME: ["Baréin", "Jordania", "Líbano", "Yemen"],
    APAC: ["Afganistán", "Australia", "Camboya", "China", "Japón", "Laos", "Mongolia", "Nueva Zelanda", "Papúa Nueva Guinea", "Filipinas", "Taiwán", "Tayikistán", "Tailandia", "Turkmenistán", "Uzbekistán", "Vietnam"],
    AFR: ["Argelia", "Angola", "Benín", "Botsuana", "Burkina Faso", "Burundi", "Camerún", "Chad", "República del Congo", "Eritrea", "Esuatini", "Etiopía", "Gabón", "Gambia", "Ghana", "Guinea-Bisáu", "Costa de Marfil", "Kenia", "Lesoto", "Liberia", "Libia", "Madagascar", "Malaui", "Malí", "Mauritania", "Mozambique", "Namibia", "Níger", "Ruanda", "Senegal", "Sierra Leona", "Somalia", "Sudán del Sur", "Sudán", "Tanzania", "Togo", "Túnez", "Uganda", "Zambia", "Zimbabue"]
  };

  // Lista plana de países para el selector: { label, id, tarifa }
  const entries = [];
  Object.keys(OWN).forEach((id) => {
    entries.push({ label: OWN[id][0], rateId: id, marketing: OWN[id][1], utility: OWN[id][2], market: OWN[id][0] });
  });
  Object.keys(MEMBERS).forEach((rid) => {
    MEMBERS[rid].forEach((name) => {
      entries.push({ label: name, rateId: rid, marketing: REGIONS[rid][1], utility: REGIONS[rid][2], market: REGIONS[rid][0] });
    });
  });
  entries.sort((a, b) => a.label.localeCompare(b.label, "es"));
  // "Otros países" siempre al final
  entries.push({ label: "Otro país (no listado)", rateId: "OTHER", marketing: REGIONS.OTHER[1], utility: REGIONS.OTHER[2], market: REGIONS.OTHER[0] });

  return {
    entries: entries,
    freeServicePerNumber: 1000,
    effectiveFrom: "1 de octubre de 2026",
    // Países cuyo selector debería aparecer primero (público objetivo de BigWay)
    featured: ["Venezuela", "Colombia", "México", "Argentina", "Chile", "Perú", "España", "Estados Unidos"]
  };
})();

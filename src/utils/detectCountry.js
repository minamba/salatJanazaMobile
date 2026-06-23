const ISO_TO_FR = {
  AF: 'Afghanistan', ZA: 'Afrique du Sud', AL: 'Albanie', DZ: 'Algérie',
  DE: 'Allemagne', AD: 'Andorre', AO: 'Angola', AG: 'Antigua-et-Barbuda',
  SA: 'Arabie saoudite', AR: 'Argentine', AM: 'Arménie', AU: 'Australie',
  AT: 'Autriche', AZ: 'Azerbaïdjan', BS: 'Bahamas', BH: 'Bahreïn',
  BD: 'Bangladesh', BB: 'Barbade', BY: 'Bélarus', BE: 'Belgique',
  BZ: 'Belize', BJ: 'Bénin', BT: 'Bhoutan', BO: 'Bolivie',
  BA: 'Bosnie-Herzégovine', BW: 'Botswana', BR: 'Brésil', BN: 'Brunéi',
  BG: 'Bulgarie', BF: 'Burkina Faso', BI: 'Burundi', CV: 'Cabo Verde',
  KH: 'Cambodge', CM: 'Cameroun', CA: 'Canada', CF: 'Centrafrique',
  CL: 'Chili', CN: 'Chine', CY: 'Chypre', CO: 'Colombie',
  KM: 'Comores', CG: 'Congo', CD: 'Congo (RDC)', KP: 'Corée du Nord',
  KR: 'Corée du Sud', CR: 'Costa Rica', CI: "Côte d'Ivoire", HR: 'Croatie',
  CU: 'Cuba', DK: 'Danemark', DJ: 'Djibouti', DM: 'Dominique',
  EG: 'Égypte', AE: 'Émirats arabes unis', EC: 'Équateur', ER: 'Érythrée',
  ES: 'Espagne', EE: 'Estonie', SZ: 'Eswatini', US: 'États-Unis',
  ET: 'Éthiopie', FJ: 'Fidji', FI: 'Finlande', FR: 'France',
  GA: 'Gabon', GM: 'Gambie', GE: 'Géorgie', GH: 'Ghana',
  GR: 'Grèce', GD: 'Grenade', GT: 'Guatemala', GN: 'Guinée',
  GW: 'Guinée-Bissau', GQ: 'Guinée équatoriale', GY: 'Guyana', HT: 'Haïti',
  HN: 'Honduras', HU: 'Hongrie', IN: 'Inde', ID: 'Indonésie',
  IQ: 'Irak', IR: 'Iran', IE: 'Irlande', IS: 'Islande',
  IL: 'Israël', IT: 'Italie', JM: 'Jamaïque', JP: 'Japon',
  JO: 'Jordanie', KZ: 'Kazakhstan', KE: 'Kenya', KG: 'Kirghizistan',
  KI: 'Kiribati', KW: 'Koweït', LA: 'Laos', LS: 'Lesotho',
  LV: 'Lettonie', LB: 'Liban', LR: 'Libéria', LY: 'Libye',
  LI: 'Liechtenstein', LT: 'Lituanie', LU: 'Luxembourg', MG: 'Madagascar',
  MY: 'Malaisie', MW: 'Malawi', MV: 'Maldives', ML: 'Mali',
  MT: 'Malte', MA: 'Maroc', MH: 'Marshall', MR: 'Mauritanie',
  MU: 'Maurice', MX: 'Mexique', FM: 'Micronésie', MD: 'Moldavie',
  MC: 'Monaco', MN: 'Mongolie', ME: 'Monténégro', MZ: 'Mozambique',
  MM: 'Myanmar', NA: 'Namibie', NR: 'Nauru', NP: 'Népal',
  NI: 'Nicaragua', NE: 'Niger', NG: 'Nigéria', NO: 'Norvège',
  NZ: 'Nouvelle-Zélande', OM: 'Oman', UG: 'Ouganda', UZ: 'Ouzbékistan',
  PK: 'Pakistan', PW: 'Palaos', PS: 'Palestine', PA: 'Panama',
  PG: 'Papouasie-Nouvelle-Guinée', PY: 'Paraguay', NL: 'Pays-Bas',
  PE: 'Pérou', PH: 'Philippines', PL: 'Pologne', PT: 'Portugal',
  QA: 'Qatar', DO: 'République dominicaine', CZ: 'République tchèque',
  RO: 'Roumanie', GB: 'Royaume-Uni', RU: 'Russie', RW: 'Rwanda',
  KN: 'Saint-Kitts-et-Nevis', SM: 'Saint-Marin', VC: 'Saint-Vincent-et-les-Grenadines',
  LC: 'Sainte-Lucie', SB: 'Salomon', SV: 'Salvador', WS: 'Samoa',
  ST: 'São Tomé-et-Príncipe', SN: 'Sénégal', RS: 'Serbie', SC: 'Seychelles',
  SL: 'Sierra Leone', SG: 'Singapour', SK: 'Slovaquie', SI: 'Slovénie',
  SO: 'Somalie', SD: 'Soudan', SS: 'Soudan du Sud', LK: 'Sri Lanka',
  SE: 'Suède', CH: 'Suisse', SR: 'Suriname', SY: 'Syrie',
  TJ: 'Tadjikistan', TZ: 'Tanzanie', TD: 'Tchad', TH: 'Thaïlande',
  TL: 'Timor oriental', TG: 'Togo', TO: 'Tonga', TT: 'Trinité-et-Tobago',
  TN: 'Tunisie', TM: 'Turkménistan', TR: 'Turquie', TV: 'Tuvalu',
  UA: 'Ukraine', UY: 'Uruguay', VU: 'Vanuatu', VA: 'Vatican',
  VE: 'Venezuela', VN: 'Viêt Nam', YE: 'Yémen', ZM: 'Zambie',
  ZW: 'Zimbabwe',
};

let _cached = undefined;

export async function detectCountryFromIP() {
  if (_cached !== undefined) return _cached;
  try {
    const res = await fetch('https://api.country.is/');
    const data = await res.json();
    _cached = ISO_TO_FR[data?.country] ?? null;
  } catch {
    _cached = null;
  }
  return _cached;
}

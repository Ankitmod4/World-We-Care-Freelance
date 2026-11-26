/**
 * Geography seed — UN M49 regions & sub-regions, ISO 3166 countries,
 * and USPS US states.
 *
 * Idempotent: keyed on slug/code. Safe to re-run — only inserts
 * missing rows, never overwrites edits from the admin panel.
 *
 * Run:
 *   npm run db:seed-geo
 *
 * Data is embedded here rather than pulled from an npm package so
 * the seed keeps working offline and the exact set of rows is
 * reviewable in the diff.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Regions (UN M49 macro-geographical regions) ────────────────────
const REGIONS: Array<{ code: string; slug: string; name: string; sortOrder: number }> = [
  { code: "002", slug: "africa",   name: "Africa",   sortOrder: 10 },
  { code: "019", slug: "americas", name: "Americas", sortOrder: 20 },
  { code: "142", slug: "asia",     name: "Asia",     sortOrder: 30 },
  { code: "150", slug: "europe",   name: "Europe",   sortOrder: 40 },
  { code: "009", slug: "oceania",  name: "Oceania",  sortOrder: 50 },
  { code: "010", slug: "antarctica", name: "Antarctica", sortOrder: 60 },
];

// ── Sub-regions (UN M49) ──────────────────────────────────────────
const SUB_REGIONS: Array<{
  code: string;
  slug: string;
  name: string;
  regionCode: string; // FK to REGIONS.code
  sortOrder: number;
}> = [
  // Africa
  { code: "015", slug: "northern-africa",  name: "Northern Africa",  regionCode: "002", sortOrder: 10 },
  { code: "011", slug: "western-africa",   name: "Western Africa",   regionCode: "002", sortOrder: 20 },
  { code: "017", slug: "middle-africa",    name: "Middle Africa",    regionCode: "002", sortOrder: 30 },
  { code: "014", slug: "eastern-africa",   name: "Eastern Africa",   regionCode: "002", sortOrder: 40 },
  { code: "018", slug: "southern-africa",  name: "Southern Africa",  regionCode: "002", sortOrder: 50 },
  // Americas
  { code: "021", slug: "northern-america", name: "Northern America", regionCode: "019", sortOrder: 10 },
  { code: "013", slug: "central-america",  name: "Central America",  regionCode: "019", sortOrder: 20 },
  { code: "029", slug: "caribbean",        name: "Caribbean",        regionCode: "019", sortOrder: 30 },
  { code: "005", slug: "south-america",    name: "South America",    regionCode: "019", sortOrder: 40 },
  // Asia
  { code: "143", slug: "central-asia",     name: "Central Asia",     regionCode: "142", sortOrder: 10 },
  { code: "030", slug: "eastern-asia",     name: "Eastern Asia",     regionCode: "142", sortOrder: 20 },
  { code: "034", slug: "southern-asia",    name: "Southern Asia",    regionCode: "142", sortOrder: 30 },
  { code: "035", slug: "south-eastern-asia", name: "South-Eastern Asia", regionCode: "142", sortOrder: 40 },
  { code: "145", slug: "western-asia",     name: "Western Asia",     regionCode: "142", sortOrder: 50 },
  // Europe
  { code: "154", slug: "northern-europe",  name: "Northern Europe",  regionCode: "150", sortOrder: 10 },
  { code: "155", slug: "western-europe",   name: "Western Europe",   regionCode: "150", sortOrder: 20 },
  { code: "151", slug: "eastern-europe",   name: "Eastern Europe",   regionCode: "150", sortOrder: 30 },
  { code: "039", slug: "southern-europe",  name: "Southern Europe",  regionCode: "150", sortOrder: 40 },
  // Oceania
  { code: "053", slug: "australia-and-new-zealand", name: "Australia and New Zealand", regionCode: "009", sortOrder: 10 },
  { code: "054", slug: "melanesia",        name: "Melanesia",        regionCode: "009", sortOrder: 20 },
  { code: "057", slug: "micronesia",       name: "Micronesia",       regionCode: "009", sortOrder: 30 },
  { code: "061", slug: "polynesia",        name: "Polynesia",        regionCode: "009", sortOrder: 40 },
];

// ── Countries (subset of ISO 3166-1) ──────────────────────────────
// Slug is the URL slug. code is alpha-2. subRegionCode is FK to
// SUB_REGIONS.code. Emoji flag is a regional-indicator pair.
interface CountrySeed {
  code: string;
  code3: string;
  slug: string;
  name: string;
  subRegionCode: string;
  emoji: string;
  phone?: string;
  currency?: string;
  language?: string;
}

const COUNTRIES: CountrySeed[] = [
  // Northern America (021)
  { code: "US", code3: "USA", slug: "united-states",  name: "United States",  subRegionCode: "021", emoji: "🇺🇸", phone: "+1",   currency: "USD", language: "English" },
  { code: "CA", code3: "CAN", slug: "canada",         name: "Canada",         subRegionCode: "021", emoji: "🇨🇦", phone: "+1",   currency: "CAD", language: "English" },
  { code: "MX", code3: "MEX", slug: "mexico",         name: "Mexico",         subRegionCode: "021", emoji: "🇲🇽", phone: "+52",  currency: "MXN", language: "Spanish" },
  { code: "BM", code3: "BMU", slug: "bermuda",        name: "Bermuda",        subRegionCode: "021", emoji: "🇧🇲", phone: "+1",   currency: "BMD", language: "English" },
  { code: "GL", code3: "GRL", slug: "greenland",      name: "Greenland",      subRegionCode: "021", emoji: "🇬🇱", phone: "+299", currency: "DKK", language: "Greenlandic" },

  // Central America (013)
  { code: "BZ", code3: "BLZ", slug: "belize",         name: "Belize",         subRegionCode: "013", emoji: "🇧🇿", phone: "+501", currency: "BZD", language: "English" },
  { code: "CR", code3: "CRI", slug: "costa-rica",     name: "Costa Rica",     subRegionCode: "013", emoji: "🇨🇷", phone: "+506", currency: "CRC", language: "Spanish" },
  { code: "SV", code3: "SLV", slug: "el-salvador",    name: "El Salvador",    subRegionCode: "013", emoji: "🇸🇻", phone: "+503", currency: "USD", language: "Spanish" },
  { code: "GT", code3: "GTM", slug: "guatemala",      name: "Guatemala",      subRegionCode: "013", emoji: "🇬🇹", phone: "+502", currency: "GTQ", language: "Spanish" },
  { code: "HN", code3: "HND", slug: "honduras",       name: "Honduras",       subRegionCode: "013", emoji: "🇭🇳", phone: "+504", currency: "HNL", language: "Spanish" },
  { code: "NI", code3: "NIC", slug: "nicaragua",      name: "Nicaragua",      subRegionCode: "013", emoji: "🇳🇮", phone: "+505", currency: "NIO", language: "Spanish" },
  { code: "PA", code3: "PAN", slug: "panama",         name: "Panama",         subRegionCode: "013", emoji: "🇵🇦", phone: "+507", currency: "PAB", language: "Spanish" },

  // Caribbean (029)
  { code: "BS", code3: "BHS", slug: "bahamas",        name: "Bahamas",        subRegionCode: "029", emoji: "🇧🇸", phone: "+1",   currency: "BSD", language: "English" },
  { code: "BB", code3: "BRB", slug: "barbados",       name: "Barbados",       subRegionCode: "029", emoji: "🇧🇧", phone: "+1",   currency: "BBD", language: "English" },
  { code: "CU", code3: "CUB", slug: "cuba",           name: "Cuba",           subRegionCode: "029", emoji: "🇨🇺", phone: "+53",  currency: "CUP", language: "Spanish" },
  { code: "DO", code3: "DOM", slug: "dominican-republic", name: "Dominican Republic", subRegionCode: "029", emoji: "🇩🇴", phone: "+1", currency: "DOP", language: "Spanish" },
  { code: "HT", code3: "HTI", slug: "haiti",          name: "Haiti",          subRegionCode: "029", emoji: "🇭🇹", phone: "+509", currency: "HTG", language: "French" },
  { code: "JM", code3: "JAM", slug: "jamaica",        name: "Jamaica",        subRegionCode: "029", emoji: "🇯🇲", phone: "+1",   currency: "JMD", language: "English" },
  { code: "PR", code3: "PRI", slug: "puerto-rico",    name: "Puerto Rico",    subRegionCode: "029", emoji: "🇵🇷", phone: "+1",   currency: "USD", language: "Spanish" },
  { code: "TT", code3: "TTO", slug: "trinidad-and-tobago", name: "Trinidad and Tobago", subRegionCode: "029", emoji: "🇹🇹", phone: "+1", currency: "TTD", language: "English" },

  // South America (005)
  { code: "AR", code3: "ARG", slug: "argentina",      name: "Argentina",      subRegionCode: "005", emoji: "🇦🇷", phone: "+54",  currency: "ARS", language: "Spanish" },
  { code: "BO", code3: "BOL", slug: "bolivia",        name: "Bolivia",        subRegionCode: "005", emoji: "🇧🇴", phone: "+591", currency: "BOB", language: "Spanish" },
  { code: "BR", code3: "BRA", slug: "brazil",         name: "Brazil",         subRegionCode: "005", emoji: "🇧🇷", phone: "+55",  currency: "BRL", language: "Portuguese" },
  { code: "CL", code3: "CHL", slug: "chile",          name: "Chile",          subRegionCode: "005", emoji: "🇨🇱", phone: "+56",  currency: "CLP", language: "Spanish" },
  { code: "CO", code3: "COL", slug: "colombia",       name: "Colombia",       subRegionCode: "005", emoji: "🇨🇴", phone: "+57",  currency: "COP", language: "Spanish" },
  { code: "EC", code3: "ECU", slug: "ecuador",        name: "Ecuador",        subRegionCode: "005", emoji: "🇪🇨", phone: "+593", currency: "USD", language: "Spanish" },
  { code: "GY", code3: "GUY", slug: "guyana",         name: "Guyana",         subRegionCode: "005", emoji: "🇬🇾", phone: "+592", currency: "GYD", language: "English" },
  { code: "PY", code3: "PRY", slug: "paraguay",       name: "Paraguay",       subRegionCode: "005", emoji: "🇵🇾", phone: "+595", currency: "PYG", language: "Spanish" },
  { code: "PE", code3: "PER", slug: "peru",           name: "Peru",           subRegionCode: "005", emoji: "🇵🇪", phone: "+51",  currency: "PEN", language: "Spanish" },
  { code: "SR", code3: "SUR", slug: "suriname",       name: "Suriname",       subRegionCode: "005", emoji: "🇸🇷", phone: "+597", currency: "SRD", language: "Dutch" },
  { code: "UY", code3: "URY", slug: "uruguay",        name: "Uruguay",        subRegionCode: "005", emoji: "🇺🇾", phone: "+598", currency: "UYU", language: "Spanish" },
  { code: "VE", code3: "VEN", slug: "venezuela",      name: "Venezuela",      subRegionCode: "005", emoji: "🇻🇪", phone: "+58",  currency: "VES", language: "Spanish" },

  // Northern Europe (154)
  { code: "DK", code3: "DNK", slug: "denmark",        name: "Denmark",        subRegionCode: "154", emoji: "🇩🇰", phone: "+45",  currency: "DKK", language: "Danish" },
  { code: "EE", code3: "EST", slug: "estonia",        name: "Estonia",        subRegionCode: "154", emoji: "🇪🇪", phone: "+372", currency: "EUR", language: "Estonian" },
  { code: "FI", code3: "FIN", slug: "finland",        name: "Finland",        subRegionCode: "154", emoji: "🇫🇮", phone: "+358", currency: "EUR", language: "Finnish" },
  { code: "IS", code3: "ISL", slug: "iceland",        name: "Iceland",        subRegionCode: "154", emoji: "🇮🇸", phone: "+354", currency: "ISK", language: "Icelandic" },
  { code: "IE", code3: "IRL", slug: "ireland",        name: "Ireland",        subRegionCode: "154", emoji: "🇮🇪", phone: "+353", currency: "EUR", language: "English" },
  { code: "LV", code3: "LVA", slug: "latvia",         name: "Latvia",         subRegionCode: "154", emoji: "🇱🇻", phone: "+371", currency: "EUR", language: "Latvian" },
  { code: "LT", code3: "LTU", slug: "lithuania",      name: "Lithuania",      subRegionCode: "154", emoji: "🇱🇹", phone: "+370", currency: "EUR", language: "Lithuanian" },
  { code: "NO", code3: "NOR", slug: "norway",         name: "Norway",         subRegionCode: "154", emoji: "🇳🇴", phone: "+47",  currency: "NOK", language: "Norwegian" },
  { code: "SE", code3: "SWE", slug: "sweden",         name: "Sweden",         subRegionCode: "154", emoji: "🇸🇪", phone: "+46",  currency: "SEK", language: "Swedish" },
  { code: "GB", code3: "GBR", slug: "united-kingdom", name: "United Kingdom", subRegionCode: "154", emoji: "🇬🇧", phone: "+44",  currency: "GBP", language: "English" },

  // Western Europe (155)
  { code: "AT", code3: "AUT", slug: "austria",        name: "Austria",        subRegionCode: "155", emoji: "🇦🇹", phone: "+43",  currency: "EUR", language: "German" },
  { code: "BE", code3: "BEL", slug: "belgium",        name: "Belgium",        subRegionCode: "155", emoji: "🇧🇪", phone: "+32",  currency: "EUR", language: "Dutch" },
  { code: "FR", code3: "FRA", slug: "france",         name: "France",         subRegionCode: "155", emoji: "🇫🇷", phone: "+33",  currency: "EUR", language: "French" },
  { code: "DE", code3: "DEU", slug: "germany",        name: "Germany",        subRegionCode: "155", emoji: "🇩🇪", phone: "+49",  currency: "EUR", language: "German" },
  { code: "LU", code3: "LUX", slug: "luxembourg",     name: "Luxembourg",     subRegionCode: "155", emoji: "🇱🇺", phone: "+352", currency: "EUR", language: "Luxembourgish" },
  { code: "NL", code3: "NLD", slug: "netherlands",    name: "Netherlands",    subRegionCode: "155", emoji: "🇳🇱", phone: "+31",  currency: "EUR", language: "Dutch" },
  { code: "CH", code3: "CHE", slug: "switzerland",    name: "Switzerland",    subRegionCode: "155", emoji: "🇨🇭", phone: "+41",  currency: "CHF", language: "German" },

  // Southern Europe (039)
  { code: "AL", code3: "ALB", slug: "albania",        name: "Albania",        subRegionCode: "039", emoji: "🇦🇱", phone: "+355", currency: "ALL", language: "Albanian" },
  { code: "BA", code3: "BIH", slug: "bosnia-and-herzegovina", name: "Bosnia and Herzegovina", subRegionCode: "039", emoji: "🇧🇦", phone: "+387", currency: "BAM", language: "Bosnian" },
  { code: "HR", code3: "HRV", slug: "croatia",        name: "Croatia",        subRegionCode: "039", emoji: "🇭🇷", phone: "+385", currency: "EUR", language: "Croatian" },
  { code: "GR", code3: "GRC", slug: "greece",         name: "Greece",         subRegionCode: "039", emoji: "🇬🇷", phone: "+30",  currency: "EUR", language: "Greek" },
  { code: "IT", code3: "ITA", slug: "italy",          name: "Italy",          subRegionCode: "039", emoji: "🇮🇹", phone: "+39",  currency: "EUR", language: "Italian" },
  { code: "PT", code3: "PRT", slug: "portugal",       name: "Portugal",       subRegionCode: "039", emoji: "🇵🇹", phone: "+351", currency: "EUR", language: "Portuguese" },
  { code: "ES", code3: "ESP", slug: "spain",          name: "Spain",          subRegionCode: "039", emoji: "🇪🇸", phone: "+34",  currency: "EUR", language: "Spanish" },
  { code: "RS", code3: "SRB", slug: "serbia",         name: "Serbia",         subRegionCode: "039", emoji: "🇷🇸", phone: "+381", currency: "RSD", language: "Serbian" },
  { code: "SI", code3: "SVN", slug: "slovenia",       name: "Slovenia",       subRegionCode: "039", emoji: "🇸🇮", phone: "+386", currency: "EUR", language: "Slovenian" },

  // Eastern Europe (151)
  { code: "BG", code3: "BGR", slug: "bulgaria",       name: "Bulgaria",       subRegionCode: "151", emoji: "🇧🇬", phone: "+359", currency: "BGN", language: "Bulgarian" },
  { code: "CZ", code3: "CZE", slug: "czechia",        name: "Czechia",        subRegionCode: "151", emoji: "🇨🇿", phone: "+420", currency: "CZK", language: "Czech" },
  { code: "HU", code3: "HUN", slug: "hungary",        name: "Hungary",        subRegionCode: "151", emoji: "🇭🇺", phone: "+36",  currency: "HUF", language: "Hungarian" },
  { code: "PL", code3: "POL", slug: "poland",         name: "Poland",         subRegionCode: "151", emoji: "🇵🇱", phone: "+48",  currency: "PLN", language: "Polish" },
  { code: "RO", code3: "ROU", slug: "romania",        name: "Romania",        subRegionCode: "151", emoji: "🇷🇴", phone: "+40",  currency: "RON", language: "Romanian" },
  { code: "RU", code3: "RUS", slug: "russia",         name: "Russia",         subRegionCode: "151", emoji: "🇷🇺", phone: "+7",   currency: "RUB", language: "Russian" },
  { code: "SK", code3: "SVK", slug: "slovakia",       name: "Slovakia",       subRegionCode: "151", emoji: "🇸🇰", phone: "+421", currency: "EUR", language: "Slovak" },
  { code: "UA", code3: "UKR", slug: "ukraine",        name: "Ukraine",        subRegionCode: "151", emoji: "🇺🇦", phone: "+380", currency: "UAH", language: "Ukrainian" },

  // Western Asia (145)
  { code: "AE", code3: "ARE", slug: "united-arab-emirates", name: "United Arab Emirates", subRegionCode: "145", emoji: "🇦🇪", phone: "+971", currency: "AED", language: "Arabic" },
  { code: "IL", code3: "ISR", slug: "israel",         name: "Israel",         subRegionCode: "145", emoji: "🇮🇱", phone: "+972", currency: "ILS", language: "Hebrew" },
  { code: "JO", code3: "JOR", slug: "jordan",         name: "Jordan",         subRegionCode: "145", emoji: "🇯🇴", phone: "+962", currency: "JOD", language: "Arabic" },
  { code: "KW", code3: "KWT", slug: "kuwait",         name: "Kuwait",         subRegionCode: "145", emoji: "🇰🇼", phone: "+965", currency: "KWD", language: "Arabic" },
  { code: "LB", code3: "LBN", slug: "lebanon",        name: "Lebanon",        subRegionCode: "145", emoji: "🇱🇧", phone: "+961", currency: "LBP", language: "Arabic" },
  { code: "QA", code3: "QAT", slug: "qatar",          name: "Qatar",          subRegionCode: "145", emoji: "🇶🇦", phone: "+974", currency: "QAR", language: "Arabic" },
  { code: "SA", code3: "SAU", slug: "saudi-arabia",   name: "Saudi Arabia",   subRegionCode: "145", emoji: "🇸🇦", phone: "+966", currency: "SAR", language: "Arabic" },
  { code: "SY", code3: "SYR", slug: "syria",          name: "Syria",          subRegionCode: "145", emoji: "🇸🇾", phone: "+963", currency: "SYP", language: "Arabic" },
  { code: "TR", code3: "TUR", slug: "turkey",         name: "Turkey",         subRegionCode: "145", emoji: "🇹🇷", phone: "+90",  currency: "TRY", language: "Turkish" },
  { code: "YE", code3: "YEM", slug: "yemen",          name: "Yemen",          subRegionCode: "145", emoji: "🇾🇪", phone: "+967", currency: "YER", language: "Arabic" },

  // Central Asia (143)
  { code: "KZ", code3: "KAZ", slug: "kazakhstan",     name: "Kazakhstan",     subRegionCode: "143", emoji: "🇰🇿", phone: "+7",   currency: "KZT", language: "Kazakh" },
  { code: "KG", code3: "KGZ", slug: "kyrgyzstan",     name: "Kyrgyzstan",     subRegionCode: "143", emoji: "🇰🇬", phone: "+996", currency: "KGS", language: "Kyrgyz" },
  { code: "TJ", code3: "TJK", slug: "tajikistan",     name: "Tajikistan",     subRegionCode: "143", emoji: "🇹🇯", phone: "+992", currency: "TJS", language: "Tajik" },
  { code: "TM", code3: "TKM", slug: "turkmenistan",   name: "Turkmenistan",   subRegionCode: "143", emoji: "🇹🇲", phone: "+993", currency: "TMT", language: "Turkmen" },
  { code: "UZ", code3: "UZB", slug: "uzbekistan",     name: "Uzbekistan",     subRegionCode: "143", emoji: "🇺🇿", phone: "+998", currency: "UZS", language: "Uzbek" },

  // Eastern Asia (030)
  { code: "CN", code3: "CHN", slug: "china",          name: "China",          subRegionCode: "030", emoji: "🇨🇳", phone: "+86",  currency: "CNY", language: "Chinese" },
  { code: "HK", code3: "HKG", slug: "hong-kong",      name: "Hong Kong",      subRegionCode: "030", emoji: "🇭🇰", phone: "+852", currency: "HKD", language: "Chinese" },
  { code: "JP", code3: "JPN", slug: "japan",          name: "Japan",          subRegionCode: "030", emoji: "🇯🇵", phone: "+81",  currency: "JPY", language: "Japanese" },
  { code: "MO", code3: "MAC", slug: "macao",          name: "Macao",          subRegionCode: "030", emoji: "🇲🇴", phone: "+853", currency: "MOP", language: "Chinese" },
  { code: "MN", code3: "MNG", slug: "mongolia",       name: "Mongolia",       subRegionCode: "030", emoji: "🇲🇳", phone: "+976", currency: "MNT", language: "Mongolian" },
  { code: "KP", code3: "PRK", slug: "north-korea",    name: "North Korea",    subRegionCode: "030", emoji: "🇰🇵", phone: "+850", currency: "KPW", language: "Korean" },
  { code: "KR", code3: "KOR", slug: "south-korea",    name: "South Korea",    subRegionCode: "030", emoji: "🇰🇷", phone: "+82",  currency: "KRW", language: "Korean" },
  { code: "TW", code3: "TWN", slug: "taiwan",         name: "Taiwan",         subRegionCode: "030", emoji: "🇹🇼", phone: "+886", currency: "TWD", language: "Chinese" },

  // Southern Asia (034)
  { code: "AF", code3: "AFG", slug: "afghanistan",    name: "Afghanistan",    subRegionCode: "034", emoji: "🇦🇫", phone: "+93",  currency: "AFN", language: "Pashto" },
  { code: "BD", code3: "BGD", slug: "bangladesh",     name: "Bangladesh",     subRegionCode: "034", emoji: "🇧🇩", phone: "+880", currency: "BDT", language: "Bengali" },
  { code: "BT", code3: "BTN", slug: "bhutan",         name: "Bhutan",         subRegionCode: "034", emoji: "🇧🇹", phone: "+975", currency: "BTN", language: "Dzongkha" },
  { code: "IN", code3: "IND", slug: "india",          name: "India",          subRegionCode: "034", emoji: "🇮🇳", phone: "+91",  currency: "INR", language: "Hindi" },
  { code: "IR", code3: "IRN", slug: "iran",           name: "Iran",           subRegionCode: "034", emoji: "🇮🇷", phone: "+98",  currency: "IRR", language: "Persian" },
  { code: "MV", code3: "MDV", slug: "maldives",       name: "Maldives",       subRegionCode: "034", emoji: "🇲🇻", phone: "+960", currency: "MVR", language: "Dhivehi" },
  { code: "NP", code3: "NPL", slug: "nepal",          name: "Nepal",          subRegionCode: "034", emoji: "🇳🇵", phone: "+977", currency: "NPR", language: "Nepali" },
  { code: "PK", code3: "PAK", slug: "pakistan",       name: "Pakistan",       subRegionCode: "034", emoji: "🇵🇰", phone: "+92",  currency: "PKR", language: "Urdu" },
  { code: "LK", code3: "LKA", slug: "sri-lanka",      name: "Sri Lanka",      subRegionCode: "034", emoji: "🇱🇰", phone: "+94",  currency: "LKR", language: "Sinhala" },

  // South-Eastern Asia (035)
  { code: "BN", code3: "BRN", slug: "brunei",         name: "Brunei",         subRegionCode: "035", emoji: "🇧🇳", phone: "+673", currency: "BND", language: "Malay" },
  { code: "KH", code3: "KHM", slug: "cambodia",       name: "Cambodia",       subRegionCode: "035", emoji: "🇰🇭", phone: "+855", currency: "KHR", language: "Khmer" },
  { code: "ID", code3: "IDN", slug: "indonesia",      name: "Indonesia",      subRegionCode: "035", emoji: "🇮🇩", phone: "+62",  currency: "IDR", language: "Indonesian" },
  { code: "LA", code3: "LAO", slug: "laos",           name: "Laos",           subRegionCode: "035", emoji: "🇱🇦", phone: "+856", currency: "LAK", language: "Lao" },
  { code: "MY", code3: "MYS", slug: "malaysia",       name: "Malaysia",       subRegionCode: "035", emoji: "🇲🇾", phone: "+60",  currency: "MYR", language: "Malay" },
  { code: "MM", code3: "MMR", slug: "myanmar",        name: "Myanmar",        subRegionCode: "035", emoji: "🇲🇲", phone: "+95",  currency: "MMK", language: "Burmese" },
  { code: "PH", code3: "PHL", slug: "philippines",    name: "Philippines",    subRegionCode: "035", emoji: "🇵🇭", phone: "+63",  currency: "PHP", language: "Filipino" },
  { code: "SG", code3: "SGP", slug: "singapore",      name: "Singapore",      subRegionCode: "035", emoji: "🇸🇬", phone: "+65",  currency: "SGD", language: "English" },
  { code: "TH", code3: "THA", slug: "thailand",       name: "Thailand",       subRegionCode: "035", emoji: "🇹🇭", phone: "+66",  currency: "THB", language: "Thai" },
  { code: "TL", code3: "TLS", slug: "timor-leste",    name: "Timor-Leste",    subRegionCode: "035", emoji: "🇹🇱", phone: "+670", currency: "USD", language: "Portuguese" },
  { code: "VN", code3: "VNM", slug: "vietnam",        name: "Vietnam",        subRegionCode: "035", emoji: "🇻🇳", phone: "+84",  currency: "VND", language: "Vietnamese" },

  // Northern Africa (015)
  { code: "DZ", code3: "DZA", slug: "algeria",        name: "Algeria",        subRegionCode: "015", emoji: "🇩🇿", phone: "+213", currency: "DZD", language: "Arabic" },
  { code: "EG", code3: "EGY", slug: "egypt",          name: "Egypt",          subRegionCode: "015", emoji: "🇪🇬", phone: "+20",  currency: "EGP", language: "Arabic" },
  { code: "LY", code3: "LBY", slug: "libya",          name: "Libya",          subRegionCode: "015", emoji: "🇱🇾", phone: "+218", currency: "LYD", language: "Arabic" },
  { code: "MA", code3: "MAR", slug: "morocco",        name: "Morocco",        subRegionCode: "015", emoji: "🇲🇦", phone: "+212", currency: "MAD", language: "Arabic" },
  { code: "SD", code3: "SDN", slug: "sudan",          name: "Sudan",          subRegionCode: "015", emoji: "🇸🇩", phone: "+249", currency: "SDG", language: "Arabic" },
  { code: "TN", code3: "TUN", slug: "tunisia",        name: "Tunisia",        subRegionCode: "015", emoji: "🇹🇳", phone: "+216", currency: "TND", language: "Arabic" },

  // Western Africa (011)
  { code: "BJ", code3: "BEN", slug: "benin",          name: "Benin",          subRegionCode: "011", emoji: "🇧🇯", phone: "+229", currency: "XOF", language: "French" },
  { code: "BF", code3: "BFA", slug: "burkina-faso",   name: "Burkina Faso",   subRegionCode: "011", emoji: "🇧🇫", phone: "+226", currency: "XOF", language: "French" },
  { code: "CV", code3: "CPV", slug: "cape-verde",     name: "Cape Verde",     subRegionCode: "011", emoji: "🇨🇻", phone: "+238", currency: "CVE", language: "Portuguese" },
  { code: "CI", code3: "CIV", slug: "cote-divoire",   name: "Côte d'Ivoire",  subRegionCode: "011", emoji: "🇨🇮", phone: "+225", currency: "XOF", language: "French" },
  { code: "GM", code3: "GMB", slug: "gambia",         name: "Gambia",         subRegionCode: "011", emoji: "🇬🇲", phone: "+220", currency: "GMD", language: "English" },
  { code: "GH", code3: "GHA", slug: "ghana",          name: "Ghana",          subRegionCode: "011", emoji: "🇬🇭", phone: "+233", currency: "GHS", language: "English" },
  { code: "GN", code3: "GIN", slug: "guinea",         name: "Guinea",         subRegionCode: "011", emoji: "🇬🇳", phone: "+224", currency: "GNF", language: "French" },
  { code: "LR", code3: "LBR", slug: "liberia",        name: "Liberia",        subRegionCode: "011", emoji: "🇱🇷", phone: "+231", currency: "LRD", language: "English" },
  { code: "ML", code3: "MLI", slug: "mali",           name: "Mali",           subRegionCode: "011", emoji: "🇲🇱", phone: "+223", currency: "XOF", language: "French" },
  { code: "MR", code3: "MRT", slug: "mauritania",     name: "Mauritania",     subRegionCode: "011", emoji: "🇲🇷", phone: "+222", currency: "MRU", language: "Arabic" },
  { code: "NE", code3: "NER", slug: "niger",          name: "Niger",          subRegionCode: "011", emoji: "🇳🇪", phone: "+227", currency: "XOF", language: "French" },
  { code: "NG", code3: "NGA", slug: "nigeria",        name: "Nigeria",        subRegionCode: "011", emoji: "🇳🇬", phone: "+234", currency: "NGN", language: "English" },
  { code: "SN", code3: "SEN", slug: "senegal",        name: "Senegal",        subRegionCode: "011", emoji: "🇸🇳", phone: "+221", currency: "XOF", language: "French" },
  { code: "SL", code3: "SLE", slug: "sierra-leone",   name: "Sierra Leone",   subRegionCode: "011", emoji: "🇸🇱", phone: "+232", currency: "SLL", language: "English" },
  { code: "TG", code3: "TGO", slug: "togo",           name: "Togo",           subRegionCode: "011", emoji: "🇹🇬", phone: "+228", currency: "XOF", language: "French" },

  // Middle Africa (017)
  { code: "AO", code3: "AGO", slug: "angola",         name: "Angola",         subRegionCode: "017", emoji: "🇦🇴", phone: "+244", currency: "AOA", language: "Portuguese" },
  { code: "CM", code3: "CMR", slug: "cameroon",       name: "Cameroon",       subRegionCode: "017", emoji: "🇨🇲", phone: "+237", currency: "XAF", language: "French" },
  { code: "CF", code3: "CAF", slug: "central-african-republic", name: "Central African Republic", subRegionCode: "017", emoji: "🇨🇫", phone: "+236", currency: "XAF", language: "French" },
  { code: "TD", code3: "TCD", slug: "chad",           name: "Chad",           subRegionCode: "017", emoji: "🇹🇩", phone: "+235", currency: "XAF", language: "French" },
  { code: "CG", code3: "COG", slug: "congo",          name: "Congo",          subRegionCode: "017", emoji: "🇨🇬", phone: "+242", currency: "XAF", language: "French" },
  { code: "CD", code3: "COD", slug: "dr-congo",       name: "DR Congo",       subRegionCode: "017", emoji: "🇨🇩", phone: "+243", currency: "CDF", language: "French" },
  { code: "GQ", code3: "GNQ", slug: "equatorial-guinea", name: "Equatorial Guinea", subRegionCode: "017", emoji: "🇬🇶", phone: "+240", currency: "XAF", language: "Spanish" },
  { code: "GA", code3: "GAB", slug: "gabon",          name: "Gabon",          subRegionCode: "017", emoji: "🇬🇦", phone: "+241", currency: "XAF", language: "French" },

  // Eastern Africa (014)
  { code: "BI", code3: "BDI", slug: "burundi",        name: "Burundi",        subRegionCode: "014", emoji: "🇧🇮", phone: "+257", currency: "BIF", language: "French" },
  { code: "KM", code3: "COM", slug: "comoros",        name: "Comoros",        subRegionCode: "014", emoji: "🇰🇲", phone: "+269", currency: "KMF", language: "Arabic" },
  { code: "DJ", code3: "DJI", slug: "djibouti",       name: "Djibouti",       subRegionCode: "014", emoji: "🇩🇯", phone: "+253", currency: "DJF", language: "French" },
  { code: "ER", code3: "ERI", slug: "eritrea",        name: "Eritrea",        subRegionCode: "014", emoji: "🇪🇷", phone: "+291", currency: "ERN", language: "Tigrinya" },
  { code: "ET", code3: "ETH", slug: "ethiopia",       name: "Ethiopia",       subRegionCode: "014", emoji: "🇪🇹", phone: "+251", currency: "ETB", language: "Amharic" },
  { code: "KE", code3: "KEN", slug: "kenya",          name: "Kenya",          subRegionCode: "014", emoji: "🇰🇪", phone: "+254", currency: "KES", language: "Swahili" },
  { code: "MG", code3: "MDG", slug: "madagascar",     name: "Madagascar",     subRegionCode: "014", emoji: "🇲🇬", phone: "+261", currency: "MGA", language: "Malagasy" },
  { code: "MW", code3: "MWI", slug: "malawi",         name: "Malawi",         subRegionCode: "014", emoji: "🇲🇼", phone: "+265", currency: "MWK", language: "English" },
  { code: "MU", code3: "MUS", slug: "mauritius",      name: "Mauritius",      subRegionCode: "014", emoji: "🇲🇺", phone: "+230", currency: "MUR", language: "English" },
  { code: "MZ", code3: "MOZ", slug: "mozambique",     name: "Mozambique",     subRegionCode: "014", emoji: "🇲🇿", phone: "+258", currency: "MZN", language: "Portuguese" },
  { code: "RW", code3: "RWA", slug: "rwanda",         name: "Rwanda",         subRegionCode: "014", emoji: "🇷🇼", phone: "+250", currency: "RWF", language: "Kinyarwanda" },
  { code: "SC", code3: "SYC", slug: "seychelles",     name: "Seychelles",     subRegionCode: "014", emoji: "🇸🇨", phone: "+248", currency: "SCR", language: "English" },
  { code: "SO", code3: "SOM", slug: "somalia",        name: "Somalia",        subRegionCode: "014", emoji: "🇸🇴", phone: "+252", currency: "SOS", language: "Somali" },
  { code: "SS", code3: "SSD", slug: "south-sudan",    name: "South Sudan",    subRegionCode: "014", emoji: "🇸🇸", phone: "+211", currency: "SSP", language: "English" },
  { code: "TZ", code3: "TZA", slug: "tanzania",       name: "Tanzania",       subRegionCode: "014", emoji: "🇹🇿", phone: "+255", currency: "TZS", language: "Swahili" },
  { code: "UG", code3: "UGA", slug: "uganda",         name: "Uganda",         subRegionCode: "014", emoji: "🇺🇬", phone: "+256", currency: "UGX", language: "English" },
  { code: "ZM", code3: "ZMB", slug: "zambia",         name: "Zambia",         subRegionCode: "014", emoji: "🇿🇲", phone: "+260", currency: "ZMW", language: "English" },
  { code: "ZW", code3: "ZWE", slug: "zimbabwe",       name: "Zimbabwe",       subRegionCode: "014", emoji: "🇿🇼", phone: "+263", currency: "ZWL", language: "English" },

  // Southern Africa (018)
  { code: "BW", code3: "BWA", slug: "botswana",       name: "Botswana",       subRegionCode: "018", emoji: "🇧🇼", phone: "+267", currency: "BWP", language: "English" },
  { code: "SZ", code3: "SWZ", slug: "eswatini",       name: "Eswatini",       subRegionCode: "018", emoji: "🇸🇿", phone: "+268", currency: "SZL", language: "English" },
  { code: "LS", code3: "LSO", slug: "lesotho",        name: "Lesotho",        subRegionCode: "018", emoji: "🇱🇸", phone: "+266", currency: "LSL", language: "English" },
  { code: "NA", code3: "NAM", slug: "namibia",        name: "Namibia",        subRegionCode: "018", emoji: "🇳🇦", phone: "+264", currency: "NAD", language: "English" },
  { code: "ZA", code3: "ZAF", slug: "south-africa",   name: "South Africa",   subRegionCode: "018", emoji: "🇿🇦", phone: "+27",  currency: "ZAR", language: "English" },

  // Australia and New Zealand (053)
  { code: "AU", code3: "AUS", slug: "australia",      name: "Australia",      subRegionCode: "053", emoji: "🇦🇺", phone: "+61",  currency: "AUD", language: "English" },
  { code: "NZ", code3: "NZL", slug: "new-zealand",    name: "New Zealand",    subRegionCode: "053", emoji: "🇳🇿", phone: "+64",  currency: "NZD", language: "English" },

  // Melanesia (054)
  { code: "FJ", code3: "FJI", slug: "fiji",           name: "Fiji",           subRegionCode: "054", emoji: "🇫🇯", phone: "+679", currency: "FJD", language: "English" },
  { code: "PG", code3: "PNG", slug: "papua-new-guinea", name: "Papua New Guinea", subRegionCode: "054", emoji: "🇵🇬", phone: "+675", currency: "PGK", language: "English" },
  { code: "SB", code3: "SLB", slug: "solomon-islands", name: "Solomon Islands", subRegionCode: "054", emoji: "🇸🇧", phone: "+677", currency: "SBD", language: "English" },
  { code: "VU", code3: "VUT", slug: "vanuatu",        name: "Vanuatu",        subRegionCode: "054", emoji: "🇻🇺", phone: "+678", currency: "VUV", language: "English" },
];

// ── US states (USPS codes + capitals) ─────────────────────────────
const US_STATES: Array<{ code: string; slug: string; name: string; capital: string; sortOrder: number }> = [
  { code: "AL", slug: "alabama",        name: "Alabama",        capital: "Montgomery",     sortOrder: 10 },
  { code: "AK", slug: "alaska",         name: "Alaska",         capital: "Juneau",         sortOrder: 20 },
  { code: "AZ", slug: "arizona",        name: "Arizona",        capital: "Phoenix",        sortOrder: 30 },
  { code: "AR", slug: "arkansas",       name: "Arkansas",       capital: "Little Rock",    sortOrder: 40 },
  { code: "CA", slug: "california",     name: "California",     capital: "Sacramento",     sortOrder: 50 },
  { code: "CO", slug: "colorado",       name: "Colorado",       capital: "Denver",         sortOrder: 60 },
  { code: "CT", slug: "connecticut",    name: "Connecticut",    capital: "Hartford",       sortOrder: 70 },
  { code: "DE", slug: "delaware",       name: "Delaware",       capital: "Dover",          sortOrder: 80 },
  { code: "FL", slug: "florida",        name: "Florida",        capital: "Tallahassee",    sortOrder: 90 },
  { code: "GA", slug: "georgia",        name: "Georgia",        capital: "Atlanta",        sortOrder: 100 },
  { code: "HI", slug: "hawaii",         name: "Hawaii",         capital: "Honolulu",       sortOrder: 110 },
  { code: "ID", slug: "idaho",          name: "Idaho",          capital: "Boise",          sortOrder: 120 },
  { code: "IL", slug: "illinois",       name: "Illinois",       capital: "Springfield",    sortOrder: 130 },
  { code: "IN", slug: "indiana",        name: "Indiana",        capital: "Indianapolis",   sortOrder: 140 },
  { code: "IA", slug: "iowa",           name: "Iowa",           capital: "Des Moines",     sortOrder: 150 },
  { code: "KS", slug: "kansas",         name: "Kansas",         capital: "Topeka",         sortOrder: 160 },
  { code: "KY", slug: "kentucky",       name: "Kentucky",       capital: "Frankfort",      sortOrder: 170 },
  { code: "LA", slug: "louisiana",      name: "Louisiana",      capital: "Baton Rouge",    sortOrder: 180 },
  { code: "ME", slug: "maine",          name: "Maine",          capital: "Augusta",        sortOrder: 190 },
  { code: "MD", slug: "maryland",       name: "Maryland",       capital: "Annapolis",      sortOrder: 200 },
  { code: "MA", slug: "massachusetts",  name: "Massachusetts",  capital: "Boston",         sortOrder: 210 },
  { code: "MI", slug: "michigan",       name: "Michigan",       capital: "Lansing",        sortOrder: 220 },
  { code: "MN", slug: "minnesota",      name: "Minnesota",      capital: "Saint Paul",     sortOrder: 230 },
  { code: "MS", slug: "mississippi",    name: "Mississippi",    capital: "Jackson",        sortOrder: 240 },
  { code: "MO", slug: "missouri",       name: "Missouri",       capital: "Jefferson City", sortOrder: 250 },
  { code: "MT", slug: "montana",        name: "Montana",        capital: "Helena",         sortOrder: 260 },
  { code: "NE", slug: "nebraska",       name: "Nebraska",       capital: "Lincoln",        sortOrder: 270 },
  { code: "NV", slug: "nevada",         name: "Nevada",         capital: "Carson City",    sortOrder: 280 },
  { code: "NH", slug: "new-hampshire",  name: "New Hampshire",  capital: "Concord",        sortOrder: 290 },
  { code: "NJ", slug: "new-jersey",     name: "New Jersey",     capital: "Trenton",        sortOrder: 300 },
  { code: "NM", slug: "new-mexico",     name: "New Mexico",     capital: "Santa Fe",       sortOrder: 310 },
  { code: "NY", slug: "new-york",       name: "New York",       capital: "Albany",         sortOrder: 320 },
  { code: "NC", slug: "north-carolina", name: "North Carolina", capital: "Raleigh",        sortOrder: 330 },
  { code: "ND", slug: "north-dakota",   name: "North Dakota",   capital: "Bismarck",       sortOrder: 340 },
  { code: "OH", slug: "ohio",           name: "Ohio",           capital: "Columbus",       sortOrder: 350 },
  { code: "OK", slug: "oklahoma",       name: "Oklahoma",       capital: "Oklahoma City",  sortOrder: 360 },
  { code: "OR", slug: "oregon",         name: "Oregon",         capital: "Salem",          sortOrder: 370 },
  { code: "PA", slug: "pennsylvania",   name: "Pennsylvania",   capital: "Harrisburg",     sortOrder: 380 },
  { code: "RI", slug: "rhode-island",   name: "Rhode Island",   capital: "Providence",     sortOrder: 390 },
  { code: "SC", slug: "south-carolina", name: "South Carolina", capital: "Columbia",       sortOrder: 400 },
  { code: "SD", slug: "south-dakota",   name: "South Dakota",   capital: "Pierre",         sortOrder: 410 },
  { code: "TN", slug: "tennessee",      name: "Tennessee",      capital: "Nashville",      sortOrder: 420 },
  { code: "TX", slug: "texas",          name: "Texas",          capital: "Austin",         sortOrder: 430 },
  { code: "UT", slug: "utah",           name: "Utah",           capital: "Salt Lake City", sortOrder: 440 },
  { code: "VT", slug: "vermont",        name: "Vermont",        capital: "Montpelier",     sortOrder: 450 },
  { code: "VA", slug: "virginia",       name: "Virginia",       capital: "Richmond",       sortOrder: 460 },
  { code: "WA", slug: "washington",     name: "Washington",     capital: "Olympia",        sortOrder: 470 },
  { code: "WV", slug: "west-virginia",  name: "West Virginia",  capital: "Charleston",     sortOrder: 480 },
  { code: "WI", slug: "wisconsin",      name: "Wisconsin",      capital: "Madison",        sortOrder: 490 },
  { code: "WY", slug: "wyoming",        name: "Wyoming",        capital: "Cheyenne",       sortOrder: 500 },
  { code: "DC", slug: "district-of-columbia", name: "District of Columbia", capital: "Washington", sortOrder: 510 },
];

async function main() {
  console.log("Seeding geography\n");

  // ── Regions ──
  let insertedRegions = 0;
  const regionIdByCode = new Map<string, string>();
  for (const r of REGIONS) {
    const existing = await prisma.region.findUnique({ where: { code: r.code } });
    if (existing) {
      regionIdByCode.set(r.code, existing.id);
      continue;
    }
    const row = await prisma.region.create({
      data: { code: r.code, slug: r.slug, name: r.name, sortOrder: r.sortOrder },
    });
    regionIdByCode.set(r.code, row.id);
    insertedRegions++;
  }
  console.log(`→ Regions: ${insertedRegions} inserted, ${REGIONS.length - insertedRegions} existing.`);

  // ── Sub-regions ──
  let insertedSubRegions = 0;
  const subRegionIdByCode = new Map<string, string>();
  for (const s of SUB_REGIONS) {
    const existing = await prisma.subRegion.findUnique({ where: { code: s.code } });
    if (existing) {
      subRegionIdByCode.set(s.code, existing.id);
      continue;
    }
    const regionId = regionIdByCode.get(s.regionCode);
    if (!regionId) {
      console.warn(`  ! Skipped sub-region ${s.name}: parent region ${s.regionCode} not found`);
      continue;
    }
    const row = await prisma.subRegion.create({
      data: {
        code: s.code,
        slug: s.slug,
        name: s.name,
        regionId,
        sortOrder: s.sortOrder,
      },
    });
    subRegionIdByCode.set(s.code, row.id);
    insertedSubRegions++;
  }
  console.log(`→ Sub-regions: ${insertedSubRegions} inserted, ${SUB_REGIONS.length - insertedSubRegions} existing.`);

  // ── Countries ──
  let insertedCountries = 0;
  let updatedCountries = 0;
  const countryIdByCode = new Map<string, string>();
  for (const c of COUNTRIES) {
    const existing = await prisma.country.findUnique({ where: { code: c.code } });
    const subRegionId = subRegionIdByCode.get(c.subRegionCode);
    if (!subRegionId) {
      console.warn(`  ! Skipped country ${c.name}: parent sub-region ${c.subRegionCode} not found`);
      continue;
    }
    if (existing) {
      countryIdByCode.set(c.code, existing.id);
      // Fill in any missing metadata but never overwrite admin edits.
      const patch: Record<string, unknown> = {};
      if (!existing.code3 && c.code3) patch.code3 = c.code3;
      if (!existing.emojiFlag && c.emoji) patch.emojiFlag = c.emoji;
      if (!existing.phoneCode && c.phone) patch.phoneCode = c.phone;
      if (!existing.currency && c.currency) patch.currency = c.currency;
      if (!existing.language && c.language) patch.language = c.language;
      if (Object.keys(patch).length > 0) {
        await prisma.country.update({ where: { id: existing.id }, data: patch });
        updatedCountries++;
      }
      continue;
    }
    const row = await prisma.country.create({
      data: {
        code: c.code,
        code3: c.code3,
        slug: c.slug,
        name: c.name,
        subRegionId,
        emojiFlag: c.emoji,
        phoneCode: c.phone,
        currency: c.currency,
        language: c.language,
      },
    });
    countryIdByCode.set(c.code, row.id);
    insertedCountries++;
  }
  console.log(
    `→ Countries: ${insertedCountries} inserted, ${updatedCountries} back-filled, ${COUNTRIES.length - insertedCountries - updatedCountries} unchanged.`,
  );

  // ── US States ──
  const usaId = countryIdByCode.get("US");
  if (!usaId) {
    console.warn("! United States not found — skipping states seed.");
  } else {
    let insertedStates = 0;
    for (const s of US_STATES) {
      const existing = await prisma.state.findFirst({
        where: { countryId: usaId, code: s.code },
      });
      if (existing) continue;
      await prisma.state.create({
        data: {
          countryId: usaId,
          code: s.code,
          slug: s.slug,
          name: s.name,
          capital: s.capital,
          sortOrder: s.sortOrder,
        },
      });
      insertedStates++;
    }
    console.log(
      `→ US States: ${insertedStates} inserted, ${US_STATES.length - insertedStates} existing.`,
    );
  }

  console.log("\nDone.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

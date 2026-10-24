/**
 * Short explanations of culturally specific words (mostly Telugu and wider Indian) that small models often don't
 * know or confuse ("muggulu" is not "muggle"). Only the terms that appear in the message are added to the prompt.
 */
const TERMS: Array<[RegExp, string]> = [
  [/\bmuggu(lu)?\b/i, "muggulu (singular muggu, Telugu): rangoli/kolam-style floor designs drawn with rice flour or chalk powder in front of homes, often dot-grid (chukkala muggulu) patterns, made especially for Sankranti and other festivals"],
  [/\bchukkala\b/i, "chukkala muggulu (Telugu): muggulu drawn by joining a grid of dots"],
  [/\bkolam\b/i, "kolam (Tamil): floor designs drawn with rice flour at the entrance of homes, similar to rangoli and muggulu"],
  [/\brangoli\b/i, "rangoli: colourful floor designs made with powders, flowers or rice, made for Diwali and other festivals"],
  [/\b(makar )?sankranti\b|\bsankranthi\b/i, "Sankranti (Makar Sankranti): mid-January harvest festival, the biggest festival in Andhra Pradesh and Telangana, with muggulu, kites, Bhogi bonfires and pongal"],
  [/\bbhogi\b/i, "Bhogi: the first day of Sankranti, with early-morning bonfires of old things"],
  [/\bbathukamma\b/i, "Bathukamma: Telangana's floral festival where women arrange flowers into cone-shaped stacks and sing and dance around them"],
  [/\bbonalu\b/i, "Bonalu: Telangana festival offering cooked rice (bonam) to the goddess Mahakali, especially in Hyderabad"],
  [/\bugadi\b/i, "Ugadi: Telugu and Kannada new year, celebrated with Ugadi pachadi (a six-taste chutney)"],
  [/\bpachadi\b/i, "pachadi (Telugu): a chutney or pickle-style side dish"],
  [/\bpulihora\b/i, "pulihora (Telugu): tangy tamarind or lemon rice, often made for festivals"],
  [/\bpesarattu\b/i, "pesarattu (Telugu): a crepe made from green gram (moong dal) batter"],
  [/\bgongura\b/i, "gongura: sour sorrel leaves, famous in Andhra cooking (gongura pachadi)"],
  [/\bbiryani\b/i, "biryani: layered spiced rice dish; Hyderabadi biryani is a famous style"],
  [/\bonam\b/i, "Onam: Kerala's harvest festival with pookalam flower rangolis and the sadya feast"],
  [/\bpookalam\b/i, "pookalam: flower rangoli made for Onam"],
  [/\bpongal\b/i, "Pongal: Tamil harvest festival (and the sweet or savoury rice dish of the same name)"],
  [/\bdasara\b|\bdussehra\b/i, "Dasara/Dussehra: autumn festival celebrating the victory of good over evil"],
  [/\bdiwali\b|\bdeepavali\b/i, "Diwali/Deepavali: festival of lights with lamps (diyas), rangoli, sweets and fireworks"],
  [/\bholi\b/i, "Holi: spring festival of colours"],
  [/\bmehendi\b|\bmehndi\b/i, "mehendi/mehndi: henna designs drawn on hands and feet for festivals and weddings"],
  [/\btollywood\b/i, "Tollywood: the Telugu film industry"],
];

export function culturalNotes(text: string) {
  return TERMS.filter(([pattern]) => pattern.test(text)).slice(0, 6).map(([, note]) => note);
}

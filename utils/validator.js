/**
 * Validation utilities for LoanInNeedServer
 */

// Comprehensive set of public, free, and temporary/disposable email provider domains
const PUBLIC_EMAIL_DOMAINS = new Set([
  // Google
  'gmail.com',
  'googlemail.com',

  // Yahoo
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.in',
  'yahoo.co.uk',
  'yahoo.com.au',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.es',
  'yahoo.it',
  'yahoo.ca',
  'yahoo.com.br',
  'ymail.com',
  'rocketmail.com',

  // Microsoft
  'outlook.com',
  'outlook.in',
  'hotmail.com',
  'hotmail.co.in',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.de',
  'hotmail.es',
  'hotmail.it',
  'live.com',
  'live.in',
  'live.co.uk',
  'msn.com',
  'windowslive.com',
  'passport.com',

  // Apple
  'icloud.com',
  'me.com',
  'mac.com',

  // Rediff
  'rediffmail.com',
  'rediff.com',

  // Zoho (public consumer domains)
  'zoho.com',
  'zoho.in',
  'zohomail.com',

  // AOL
  'aol.com',
  'aim.com',
  'aol.in',
  'aol.co.uk',

  // Proton
  'proton.me',
  'protonmail.com',
  'pm.me',
  'protonmail.ch',

  // GMX / Mail.com
  'mail.com',
  'email.com',
  'usa.com',
  'post.com',
  'consultant.com',
  'myself.com',
  'europe.com',
  'asia.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'gmx.at',
  'gmx.ch',

  // Russian / CIS
  'yandex.com',
  'yandex.ru',
  'ya.ru',
  'mail.ru',
  'inbox.ru',
  'bk.ru',
  'list.ru',
  'rambler.ru',

  // Asian Portals
  'qq.com',
  '163.com',
  '126.com',
  'sina.com',
  'sohu.com',
  'aliyun.com',
  'naver.com',
  'daum.net',
  'hanmail.net',
  'kakao.com',

  // European / Others
  'tutanota.com',
  'tutanota.de',
  'tuta.io',
  'tuta.com',
  'fastmail.com',
  'fastmail.fm',
  'inbox.com',
  'web.de',
  'freenet.de',
  't-online.de',
  'libero.it',
  'virgilio.it',
  'orange.fr',
  'free.fr',
  'laposte.net',
  'sfr.fr',
  'wanadoo.fr',
  'wp.pl',
  'onet.pl',
  'interia.pl',
  'o2.pl',
  'seznam.cz',
  'centrum.cz',
  'bol.com.br',
  'uol.com.br',
  'terra.com.br',
  'ig.com.br',

  // Temporary / Disposable Mail providers
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  '10minutemail.com',
  '10minutemail.net',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'dispostable.com',
  'mailinator.com',
  'getairmail.com',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'mega.zik.dj',
  'speed.1s.fr',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  'burnermail.io',
  'crazymailing.com',
  'fakemailgenerator.com',
  'tempail.com',
  'mohmal.com',
  'maildrop.cc',
  'inboxkitten.com'
]);

/**
 * Checks if an email address belongs to an official/corporate domain rather than a free/public/disposable email provider.
 * @param {string} email
 * @returns {boolean} True if email is an official email domain, false otherwise.
 */
function isOfficialEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domain] = parts;
  if (!localPart || !domain || !domain.includes('.')) {
    return false;
  }

  // Exact domain check
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return false;
  }

  // Check subdomains (e.g. mail.gmail.com or xyz.yahoo.co.in)
  for (const publicDomain of PUBLIC_EMAIL_DOMAINS) {
    if (domain.endsWith('.' + publicDomain)) {
      return false;
    }
  }

  return true;
}

module.exports = {
  PUBLIC_EMAIL_DOMAINS,
  isOfficialEmail
};

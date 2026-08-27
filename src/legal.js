/**
 * legal.js — shared bootstrap for standalone info pages (privacy.html and
 * friends): fills translations, sets the page title, wires the language
 * switch. No map, no search, nothing app-specific.
 */

import { t, getLang, setLang, applyTranslations } from './i18n.js';

function markActiveLang() {
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === getLang());
  });
}

function initLangSwitch() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.lang === getLang()) return;
      setLang(btn.dataset.lang);
      applyTranslations();
      document.title = t('privacy-title');
      markActiveLang();
    });
  });
  markActiveLang();
}

setLang(getLang());
applyTranslations();
document.title = t('privacy-title');
initLangSwitch();

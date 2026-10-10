// Mail-Adresse per Klick kopieren (Visitenkarten-Seiten)
(function(){
  var buttons = document.querySelectorAll('.biz-mail[data-copy]');

  function fallbackCopy(text){
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    return ok ? Promise.resolve() : Promise.reject();
  }

  function copy(text){
    if(navigator.clipboard && window.isSecureContext){
      return navigator.clipboard.writeText(text).catch(function(){ return fallbackCopy(text); });
    }
    return fallbackCopy(text);
  }

  buttons.forEach(function(btn){
    var hint = btn.querySelector('.biz-mail-hint');
    var label = hint.textContent;
    var timer;
    btn.addEventListener('click', function(){
      copy(btn.getAttribute('data-copy')).then(function(){
        hint.textContent = 'Kopiert ✓';
        btn.classList.add('is-copied');
      }, function(){
        // Kopieren nicht möglich → stattdessen Mail-Programm öffnen
        window.location.href = 'mailto:' + btn.getAttribute('data-copy');
      });
      clearTimeout(timer);
      timer = setTimeout(function(){
        hint.textContent = label;
        btn.classList.remove('is-copied');
      }, 2000);
    });
  });
})();

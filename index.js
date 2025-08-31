import{a as w}from"./assets/vendor-BkCUij8E.js";(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function n(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(s){if(s.ep)return;s.ep=!0;const r=n(s);fetch(s.href,r)}})();let m=1;async function y(){try{const e=await w.get("https://sound-wave.b.goit.study/api/artists",{params:{limit:8,page:m}});return m+=1,{artists:e.data.artists,totalArtists:e.data.totalArtists}}catch{return{artists:[],totalArtists:0}}}function S(){c.classList.add("lm-non-ative")}function k(){c.classList.add("hiden")}function _(){c.classList.remove("hiden")}function L(){b.classList.add("hiden")}function q(){b.classList.remove("hiden")}const c=document.querySelector(".load-more"),b=document.querySelector(".loader"),E=document.querySelector(".gallery");function $(e){const t=e.target.closest(".card__link");return t?t.closest(".card__body").dataset.id:null}E.addEventListener("click",e=>{const t=$(e);openModal(t)});function B(e){const t=e.map(({id:i,strArtistThumb:s,genres:r,strArtist:a,strBiographyEN:l})=>`
  <div class="card">
      <div class="card__media">
    <img src="${s}" alt="${a}" />
  </div>
  <div class="card__body" data-id="${i}">
    <div class="tags">
      ${r.map(u=>`<span class="tag">${u}</span>`).join("")}
    </div>
    <h3 class="card__title">${a}</h3>
    <p class="card__text">${l}</p>
    <div class="card__footer">
      <button class="card__link">Learn More <svg class="icon-learn-more">
            <use href="../img/sprite.svg#icon-icon_play_artists_sections"></use>
        </svg></button>
    </div>
  </div>
  </div>
`).join("");document.querySelector(".gallery").insertAdjacentHTML("beforeend",t)}y().then(({artists:e,totalArtists:t})=>{L(),B(e),_()});function M(e){const t="No description available",n=e.map(({id:s,strArtistThumb:r,genres:a,strArtist:l,strBiographyEN:u})=>{let f=u;return f||(f=t),`<div class="card">
      <div class="card__media">
    <img src="${r}" alt="${l}" />
  </div>
  <div class="card__body" data-id="${s}">
    <div class="tags">
      ${a.map(A=>`<span class="tag">${A}</span>`).join("")}
    </div>
    <h3 class="card__title">${l}</h3>
    <p class="card__text">${f}</p>
    <div class="card__footer">
<button class="card__link">Learn More <svg class="icon-learn-more">
            <use href="../img/sprite.svg#icon-icon_play_artists_sections"></use>
        </svg></button>
    </div>
  </div>
  </div>
`}).join("");document.querySelector(".gallery").insertAdjacentHTML("beforeend",n)}let p=8;c.addEventListener("click",()=>{k(),q(),y().then(({artists:e,totalArtists:t})=>{if(M(e),L(),p+=e.length,p>=t){S(),c.disabled=!0;return}_()})});const o={openBtn:document.querySelector("[data-menu-open]"),closeBtn:document.querySelector("[data-menu-close]"),menu:document.querySelector("[data-menu]"),links:document.querySelectorAll("[data-menu-link]"),logos:document.querySelectorAll(".header-logo"),header:document.querySelector(".header")};function j(){var e;o.menu&&(o.menu.hidden=!1,o.menu.classList.add("show"),document.body.style.overflow="hidden",(e=o.openBtn)==null||e.setAttribute("aria-expanded","true"))}function d(){var e;o.menu&&(o.menu.classList.remove("show"),setTimeout(()=>{o.menu.hidden=!0},400),document.body.style.overflow="",(e=o.openBtn)==null||e.setAttribute("aria-expanded","false"))}function O(e){const t=document.querySelector(e);t&&t.scrollIntoView({behavior:"smooth",block:"start"})}var v;(v=o.openBtn)==null||v.addEventListener("click",j);var h;(h=o.closeBtn)==null||h.addEventListener("click",d);o.links.forEach(e=>e.addEventListener("click",t=>{t.preventDefault();const n=e.getAttribute("href");d(),O(n)}));o.logos.forEach(e=>{e.addEventListener("click",t=>{e.closest(".mobile-menu")&&(t.preventDefault(),d(),setTimeout(()=>{window.location.href=e.getAttribute("href")},400))})});var g;(g=o.menu)==null||g.addEventListener("click",e=>{e.target===o.menu&&d()});document.addEventListener("keydown",e=>{var t;e.key==="Escape"&&((t=o.menu)!=null&&t.classList.contains("show"))&&d()});const T=document.querySelectorAll("section[id]"),x=document.querySelectorAll(".header-nav-link, .mobile-menu-nav-link");function I(){const e=window.scrollY+o.header.offsetHeight+10;T.forEach(t=>{if(e>=t.offsetTop&&e<t.offsetTop+t.offsetHeight){const n=t.getAttribute("id");x.forEach(i=>{i.classList.toggle("active",i.getAttribute("href")===`#${n}`)})}})}window.addEventListener("scroll",I);
//# sourceMappingURL=index.js.map

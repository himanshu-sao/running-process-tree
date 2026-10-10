(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const p of s.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&r(p)}).observe(document,{childList:!0,subtree:!0});function i(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function r(n){if(n.ep)return;n.ep=!0;const s=i(n);fetch(n.href,s)}})();let d=[],u=[],a={search:"",type:"all",status:"all"},o=null,l=null;const L=document.getElementById("app");function S(){b(),w(),N(),$()}function b(){L.innerHTML=`
    <header class="header">
      <div class="header-content">
        <h1 class="header-title">Service Dashboard</h1>
        <div class="header-controls">
          <button id="theme-toggle" class="btn btn-icon" aria-label="Toggle theme">
            <svg class="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg class="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <button id="refresh-btn" class="btn btn-secondary" aria-label="Refresh services">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </header>

    <main class="main">
      <div class="filters-bar">
        <div class="filter-group">
          <label for="search-input" class="visually-hidden">Search services</label>
          <input
            type="text"
            id="search-input"
            class="search-input"
            placeholder="Search services..."
            value="${a.search}"
          >
        </div>
        <div class="filter-group">
          <label for="type-filter" class="visually-hidden">Filter by type</label>
          <select id="type-filter" class="filter-select">
            <option value="all" ${a.type==="all"?"selected":""}>All Types</option>
            <option value="web_app" ${a.type==="web_app"?"selected":""}>Web App</option>
            <option value="tcp_listener" ${a.type==="tcp_listener"?"selected":""}>TCP Listener</option>
            <option value="docker_container" ${a.type==="docker_container"?"selected":""}>Docker Container</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="status-filter" class="visually-hidden">Filter by status</label>
          <select id="status-filter" class="filter-select">
            <option value="all" ${a.status==="all"?"selected":""}>All Status</option>
            <option value="http_responding" ${a.status==="http_responding"?"selected":""}>HTTP Responding</option>
            <option value="listening" ${a.status==="listening"?"selected":""}>Listening</option>
            <option value="running" ${a.status==="running"?"selected":""}>Running</option>
            <option value="exited" ${a.status==="exited"?"selected":""}>Exited</option>
          </select>
        </div>
        <div class="filter-stats">
          <span id="service-count">${u.length} / ${d.length} services</span>
          <span id="last-scan" class="${l?"":"pending"}">
            ${l?`Last scan: ${g(l)}`:"Scanning..."}
          </span>
        </div>
      </div>

      <div class="services-grid" id="services-grid">
        ${u.length>0?u.map(y).join(""):'<div class="empty-state">No services found</div>'}
      </div>
    </main>

    <footer class="footer">
      <div class="footer-content">
        <span>Service Dashboard</span>
        <span id="connection-status" class="connection-status disconnected">Disconnected</span>
      </div>
    </footer>
  `,w()}function y(e){const t=x(e.status),i=k(e.type),r=C(e.type),n=e.sources?e.sources.join(", "):e.source,s=e.lastProbed?g(e.lastProbed):"Never",p=e.ports&&e.ports.length>0?e.ports.map(h=>`${h.hostPort}:${h.containerPort}/${h.protocol}`).join(", "):"";return`
    <article class="service-card ${t}" data-identity="${e.identityKey}">
      <div class="card-header">
        <div class="card-name">
          <h3 class="service-name">${f(e.friendlyName||e.detectedName||"Unknown")}</h3>
          <span class="service-type ${r}">${i}</span>
        </div>
        <span class="service-status ${t}">${E(e.status)}</span>
      </div>

      <div class="card-details">
        <dl class="detail-list">
          <div class="detail-row">
            <dt>Port</dt>
            <dd class="port-value">${e.port||"N/A"}</dd>
          </div>
          ${e.pid?`
          <div class="detail-row">
            <dt>PID</dt>
            <dd>${e.pid}</dd>
          </div>`:""}
          ${e.containerName?`
          <div class="detail-row">
            <dt>Container</dt>
            <dd>${f(e.containerName)}</dd>
          </div>`:""}
          ${e.imageName?`
          <div class="detail-row">
            <dt>Image</dt>
            <dd>${f(e.imageName)}</dd>
          </div>`:""}
          ${p?`
          <div class="detail-row">
            <dt>Ports</dt>
            <dd>${f(p)}</dd>
          </div>`:""}
          <div class="detail-row">
            <dt>HTTP Status</dt>
            <dd class="${e.httpStatus==="responding"?"http-ok":e.httpStatus==="failed"?"http-fail":""}">
              ${e.httpStatus==="responding"?`✓ ${e.httpStatusCode} (${e.httpLatency}ms)`:e.httpStatus==="failed"?"✗ Failed":"Not probed"}
            </dd>
          </div>
          ${e.dockerHealth?`
          <div class="detail-row">
            <dt>Docker Health</dt>
            <dd class="docker-health ${e.dockerHealth.status}">${e.dockerHealth.status}</dd>
          </div>`:""}
          <div class="detail-row">
            <dt>Sources</dt>
            <dd>${f(n)}</dd>
          </div>
          <div class="detail-row">
            <dt>Last Probed</dt>
            <dd>${s}</dd>
          </div>
        </dl>
      </div>
    </article>
  `}function x(e){switch(e){case"http_responding":return"status-http-responding";case"listening":return"status-listening";case"running":return"status-running";case"exited":return"status-exited";default:return"status-unknown"}}function E(e){switch(e){case"http_responding":return"HTTP Responding";case"listening":return"Listening";case"running":return"Running";case"exited":return"Exited";default:return e}}function k(e){switch(e){case"web_app":return"Web App";case"tcp_listener":return"TCP Listener";case"docker_container":return"Docker Container";default:return e}}function C(e){switch(e){case"web_app":return"type-web";case"tcp_listener":return"type-tcp";case"docker_container":return"type-docker";default:return""}}function g(e){return new Date(e).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}function f(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}async function N(){try{const e=await fetch("/api/services");if(!e.ok)throw new Error("Failed to fetch");const t=await e.json();d=t.services||[],l=t.lastScan,c(),m()}catch(e){console.error("Failed to fetch services:",e)}}function c(){u=d.filter(e=>{if(a.search){const t=a.search.toLowerCase(),i=(e.friendlyName||e.detectedName||"").toLowerCase(),r=(e.containerName||"").toLowerCase(),n=(e.imageName||"").toLowerCase();if(!i.includes(t)&&!r.includes(t)&&!n.includes(t))return!1}return!(a.type!=="all"&&e.type!==a.type||a.status!=="all"&&e.status!==a.status)}),T(),m()}function T(){const e=document.getElementById("services-grid");e&&(u.length>0?e.innerHTML=u.map(y).join(""):e.innerHTML='<div class="empty-state">No services match current filters</div>')}function m(){const e=document.getElementById("service-count"),t=document.getElementById("last-scan");e&&(e.textContent=`${u.length} / ${d.length} services`),t&&(l?(t.textContent=`Last scan: ${g(l)}`,t.classList.remove("pending")):(t.textContent="Scanning...",t.classList.add("pending")))}function $(){o&&o.close(),o=new EventSource("/api/events"),o.onopen=()=>{v("connected")},o.onerror=()=>{v("disconnected"),setTimeout($,5e3)},o.addEventListener("init",e=>{const t=JSON.parse(e.data);d=t.services||[],l=t.lastScan,c()}),o.addEventListener("services",e=>{const t=JSON.parse(e.data);d=t.services||[],l=t.lastScan,c()}),o.addEventListener("service-updated",e=>{const t=JSON.parse(e.data),i=d.findIndex(r=>r.identityKey===t.service.identityKey);i>=0&&(d[i]=t.service,c())}),o.addEventListener("service-added",e=>{const t=JSON.parse(e.data);d.push(t.service),c()}),o.addEventListener("service-removed",e=>{const t=JSON.parse(e.data);d=d.filter(i=>i.identityKey!==t.identityKey),c()}),o.addEventListener("scan-status",e=>{const t=JSON.parse(e.data);!t.inProgress&&t.lastScan&&(l=t.lastScan,m())})}function v(e){const t=document.getElementById("connection-status");t&&(t.textContent=e==="connected"?"Live":"Disconnected",t.className=`connection-status ${e}`)}function w(){const e=document.getElementById("theme-toggle");e&&e.addEventListener("click",P);const t=document.getElementById("refresh-btn");t&&t.addEventListener("click",()=>{fetch("/api/scan",{method:"POST"}).catch(console.error)});const i=document.getElementById("search-input");i&&i.addEventListener("input",s=>{a.search=s.target.value,c()});const r=document.getElementById("type-filter");r&&r.addEventListener("change",s=>{a.type=s.target.value,c()});const n=document.getElementById("status-filter");n&&n.addEventListener("change",s=>{a.status=s.target.value,c()})}function P(){const t=document.documentElement.classList.toggle("dark");localStorage.setItem("theme",t?"dark":"light")}function I(){const e=localStorage.getItem("theme"),t=window.matchMedia("(prefers-color-scheme: dark)").matches;(e?e==="dark":t)&&document.documentElement.classList.add("dark")}I();S();

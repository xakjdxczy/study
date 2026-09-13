(function () {
  if (document.getElementById("site-nav")) return;

  var path = location.pathname || "";
  var marker = "/study/";
  var idx = path.indexOf(marker);
  var base = idx >= 0 ? path.slice(0, idx + marker.length) : "/study/";
  // local file or odd hosts: derive from depth of known roots
  if (idx < 0) {
    var parts = path.split("/").filter(Boolean);
    var dig = parts.lastIndexOf("驾照");
    if (dig < 0) dig = parts.lastIndexOf("小学");
    if (dig < 0) dig = parts.lastIndexOf("阳光英语");
    if (dig >= 0) {
      base = "/" + parts.slice(0, dig).join("/") + "/";
      if (!base.startsWith("/")) base = "/study/";
    } else {
      base = "./";
    }
  }

  function join(b, rel) {
    if (b === "./") return rel;
    return b.replace(/\/?$/, "/") + rel.replace(/^\//, "");
  }

  var inDrive = /\/驾照\//.test(path) || /驾照/.test(path);
  var inPrimary = /\/小学\//.test(path) || /\/小学$/.test(path);
  var inEn = /\/阳光英语\//.test(path);

  var sectionHref = null;
  var sectionLabel = null;
  if (inDrive) {
    sectionHref = join(base, "驾照/");
    sectionLabel = "学驾照";
  } else if (inPrimary) {
    sectionHref = join(base, "小学/");
    sectionLabel = "小学全科";
  } else if (inEn) {
    sectionHref = join(base, "阳光英语/");
    sectionLabel = "阳光英语";
  }

  var parentHref = null;
  try {
    if (!/\/study\/?$/.test(path) && path !== base) {
      parentHref = "../";
    }
  } catch (e) {}

  var nav = document.createElement("nav");
  nav.id = "site-nav";
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "全站导航");

  var html = "";
  html += '<a href="' + (base === "./" ? "../" : base) + '">首页</a>';
  if (sectionHref) {
    html += '<span class="sep" aria-hidden="true">/</span>';
    html += '<a href="' + sectionHref + '">' + sectionLabel + "</a>";
  }
  if (parentHref && sectionHref) {
    // Avoid duplicate when already on section home
    var onSectionHome =
      /\/驾照\/?$/.test(path) ||
      /\/小学\/?$/.test(path) ||
      /\/阳光英语\/?$/.test(path);
    if (!onSectionHome) {
      html += '<span class="sep" aria-hidden="true">/</span>';
      html += '<a href="' + parentHref + '">上一级</a>';
    }
  }
  html += '<span class="grow"></span>';
  html += '<span class="pill">学习资料站</span>';
  nav.innerHTML = html;

  document.body.classList.add("has-site-nav");
  document.body.insertBefore(nav, document.body.firstChild);
})();

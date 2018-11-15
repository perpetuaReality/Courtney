function toggleMenu() {
  var x = document.getElementById("menu");
  if (x.className === "") {
    x.className = " responsive";
  } else {
    x.className = "";
  }
}

function loadKeywords() {
  // @COURTNEY KEYWORDS/TRIGGERS. Has to be updated across this file and server.js. I haven't found a better way but I infer it has to do with .json files.
  var hiTriggers = ["hello", "hi", "hiya", "hewwo", "how are you"];
  var gnTriggers = ["night", "nite", "sleep", "gn", "dreams"];
  var iluTriggers = ["love you", "i love you", "<3", "<3 you", "wuv you", "i <3", "i <3 you", "i wuv you", "love u", "i love u", "<3 u", "wuv u", "i <3 u", "i wuv u", "ily", "ilu", "i love ya", "love ya", "i lov u", "<3 ya", "i lov ya", "i lov you"];
  var stanTriggers = ["stan"];
  
  var hiList = document.getElementById("key_list_hi"),
       gnList = document.getElementById("key_list_gn"),
       iluList = document.getElementById("key_list_ilu"),
       stanList = document.getElementById("key_list_stan");
  
  const populate = (element, list) => { list.innerHTML += element + "<br/>"; }
  
  hiList.innerHTML = ""; gnList.innerHTML = ""; iluList.innerHTML = ""; stanList.innerHTML = "";
  
  hiTriggers.forEach((element) => { populate(element, hiList); });
  gnTriggers.forEach((element) => { populate(element, gnList); });
  iluTriggers.forEach((element) => { populate(element, iluList); });
  stanTriggers.forEach((element) => { populate(element, stanList); });
}

function toggleKeywords() {
  var list = document.getElementById("key_list");
  var toggleBtn = document.getElementById("key_list_toggle");
  // If it's hidden, show it.
  if (list.hidden) {
    list.hidden = false;
    toggleBtn.innerText = "Hide keywords";
  // It it's showing, hide it.
  } else {
    list.hidden = true;
    toggleBtn.innerText = "Show keywords";
  }
}
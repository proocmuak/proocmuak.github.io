window.onload = function() {
  let men = document.getElementById("man");
  let women = document.getElementById("woman");
  let children = document.getElementById("children");
  let man = false;
  let woman = false;
  let childrin = false;
  men.onclick = function() {
    man == false
      ? (men.innerHTML = '<i class="fal fa-check"></i>')
      : (men.innerHTML = "");
    man = !man;
  };
  women.onclick = function() {
    woman == false
      ? (women.innerHTML = '<i class="fal fa-check"></i>')
      : (women.innerHTML = "");
    woman = !woman;
  };
  children.onclick = function() {
    childrin == false
      ? (children.innerHTML = '<i class="fal fa-check"></i>')
      : (children.innerHTML = "");
    childrin = !childrin;
  };
};

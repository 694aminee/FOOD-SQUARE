// Carte Food Square (reprise du menu affiché au comptoir).
// Pour changer un prix : modifie "price" de l'article. Les suppléments sont dans G et SUPP.
window.FS_MENU = (function () {
  "use strict";
/* ---------- icons ---------- */
const S = p => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  smash: S('<path d="M5 13c0-5 5-8 11-8s11 3 11 8z"/><path d="M4 17h24"/><path d="M5 17l3 3 3-3 3 3 3-3 3 3 3-3 3 3 2-3"/><path d="M6 23h20a2 2 0 0 1-2 3H8a2 2 0 0 1-2-3z"/><path d="M12 9l1 1M17 8l1 1"/>'),
  burger: S('<path d="M5 13c0-5 5-8 11-8s11 3 11 8z"/><path d="M4 17h24"/><path d="M4 20h24"/><path d="M6 23h20a2 2 0 0 1-2 3H8a2 2 0 0 1-2-3z"/>'),
  tacos: S('<path d="M5 9h22l-3 15H8z"/><path d="M5 9l11 7 11-7"/><path d="M10 20h12"/>'),
  sandwich: S('<path d="M3 15c3-5 23-5 26 0-3 4-23 4-26 0z"/><path d="M6 15c3 2 17 2 20 0"/><path d="M9 12v1M15 11v1M21 12v1"/>'),
  wrap: S('<path d="M10 5h12l-2 22h-8z"/><path d="M10 5c3 3 9 3 12 0"/><path d="M12 13l8 3M12 19l7 2"/>'),
  riz: S('<path d="M4 15h24a12 9 0 0 1-24 0z"/><path d="M8 15c1-4 4-5 8-5s7 1 8 5"/><path d="M12 12l1 1M17 11l1 1M21 13l1 1"/>'),
  texmex: S('<path d="M7 20c-2-5 2-11 8-12 5-1 9 3 9 7s-4 8-9 8c-4 0-7-1-8-3z"/><path d="M11 15l2 1M16 12l1 2M18 18l2-1"/>'),
  menus: S('<rect x="5" y="9" width="10" height="17" rx="1.5"/><path d="M15 13h11l-1 13H16"/><path d="M9 9l1-4M11 9l1-4"/><path d="M20 13V9l3-3"/>'),
  frites: S('<path d="M8 13h16l-2 14H10z"/><path d="M10 13l-1-8M13 13l0-9M16 13l1-9M19 13l1-8M22 13l2-7"/>'),
  sweet: S('<path d="M9 12h14l-2 15H11z"/><path d="M8 12c0-3 3-4 5-3 1-3 6-3 7 0 2-1 5 0 4 3"/><path d="M18 9l3-6"/>'),
  drink: S('<rect x="10" y="6" width="12" height="21" rx="3"/><path d="M10 11h12M10 22h12"/><path d="M14 4h4"/>')
};

/* ---------- menu data (from Food Square's printed menu) ---------- */
const DRINKS = ["Coca-Cola","Coca-Cola Zéro","Fanta Orange","Oasis Tropical","Ice Tea Pêche","Orangina","7Up","Eau Cristaline"];
const SAUCES = ["Mayonnaise","Ketchup","Blanche","Barbecue","Curry","Burger","Algérienne","Moutarde","Harissa","Chili thaï","Gruyère","Samouraï","Andalouse","Fish","Américaine","Poivre","Tartare"];
const SUPP = ["Cheddar","Œuf","Boursin","Emmental","Kiri","Chèvre","Bacon","Gruyère","Miel","Dinde"];
const VIANDES = ["Escalope","Steak","Chicken","Cordon bleu"];
const CLASSIC = ["Cheese","Double Cheese","Chicken","Giant","Bacon","Big","Deluxe","Kiri","Triple Burger"];
const SMASHES = ["Smash Cheese","Smash Beef","Smash Chicken","Chicken Smoke","Smash Smoke","Smash Raclette","Smash Chèvre Miel"];
const ch = (arr, p=0) => arr.map(n => ({n, p}));

const G = {
  formule: (p, label) => ({id:"formule", label:"Formule", type:"one", req:true, def:0, choices:[{n:"Seul", p:0}, {n: label || "En menu · frites + boisson", p}]}),
  boissonMenu: () => ({id:"boisson", label:"Boisson du menu", short:"Boisson", type:"one", req:true, when:["formule",1], choices:ch(DRINKS)}),
  sauces: () => ({id:"sauces", label:"Sauces", hint:"2 max", type:"many", max:2, choices:ch(SAUCES)}),
  supp: () => ({id:"supp", label:"Suppléments", short:"Supp.", hint:"+1 € chacun", type:"many", choices:ch(SUPP,1)}),
  viandeSupp: () => ({id:"vsupp", label:"Viande en plus", short:"Viande +", hint:"+2 € chacune", type:"many", choices:ch(VIANDES,2)}),
  gratine: () => ({id:"gratine", label:"Option gratinée", short:"Gratiné", type:"one", def:0, choices:[{n:"Non", p:0}].concat(ch(["Chèvre","Cheddar","Raclette","Mozzarella"],1.9))})
};

const CATS = [
  {id:"smash", name:"Smash", brush:true, label:"Signature", note:"Steaks smashés minute sur la plaque. En menu : frites + boisson (+2 €).", icon:"smash"},
  {id:"burger", name:"Burgers", note:"En menu : frites + boisson (+2 €).", icon:"burger"},
  {id:"tacos", name:"Tacos", note:"Viande et sauce au choix : escalope, steak, chicken, cordon bleu. En menu +2,50 €.", icon:"tacos"},
  {id:"sandwich", name:"Sandwichs", note:"Servis en pain, sauces au choix. En menu : frites + boisson.", icon:"sandwich"},
  {id:"wrap", name:"Wraps", note:"En menu : frites + boisson (+2 €).", icon:"wrap"},
  {id:"riz", name:"Riz Tasty Crousty", note:"Avec boisson +1 €.", icon:"riz"},
  {id:"texmex", name:"Tex Mex", note:"5,50 € la portion. En menu +2 € : frites + boisson.", icon:"texmex"},
  {id:"menus", name:"Menus & formules", note:"Pour les petits, les étudiants, à deux ou en famille.", icon:"menus"},
  {id:"frites", name:"Frites & salades", note:"", icon:"frites"},
  {id:"sweet", name:"Milkshakes & desserts", note:"", icon:"sweet"},
  {id:"drink", name:"Boissons", note:"", icon:"drink"}
];

const burgerOpts = () => [G.formule(2), G.boissonMenu()];
const sandOpts = (menuAdd) => [G.formule(menuAdd), G.boissonMenu(), G.sauces(), G.supp()];

const ITEMS = [
  // Smash
  {id:"sm-cheese", cat:"smash", name:"Smash Cheese", desc:"Smash beef, cheddar, cornichons, oignons, moutarde, ketchup", price:6.5, opts:[G.formule(2.4), G.boissonMenu()]},
  {id:"sm-beef", cat:"smash", name:"Smash Beef", desc:"Smash beef, cheddar, crudités, cornichons, sauce beef", price:7.9, opts:burgerOpts()},
  {id:"sm-chicken", cat:"smash", name:"Smash Chicken", desc:"Poulet pané, cheddar, sauce chicken, crudités, oignon", price:7.9, opts:burgerOpts()},
  {id:"sm-ch-smoke", cat:"smash", name:"Chicken Smoke", desc:"Poulet, cheddar, bacon, salade, oignon crispy, sauce smoke", price:8.9, opts:burgerOpts()},
  {id:"sm-smoke", cat:"smash", name:"Smash Smoke", desc:"Smash beef, crudités, cheddar, oignon crispy, bacon, sauce smoke", price:8.9, opts:burgerOpts()},
  {id:"sm-raclette", cat:"smash", name:"Smash Raclette", desc:"Smash beef, fromage à raclette, oignons, bacon", price:8.9, opts:burgerOpts()},
  {id:"sm-chevre", cat:"smash", name:"Smash Chèvre Miel", desc:"Smash beef, chèvre miel, crudités, noix, oignon caramélisé", price:8.9, opts:burgerOpts()},
  {id:"sm-triple", cat:"smash", name:"Triple Smash", desc:"3 steaks beef 80 g, 3 cheddars, salade, oignons", price:10.9, opts:burgerOpts(), badge:"Le plus gros"},
  // Burgers
  {id:"bg-cheese", cat:"burger", name:"Cheese", desc:"Steak, cheddar", price:3.5, opts:burgerOpts()},
  {id:"bg-dcheese", cat:"burger", name:"Double Cheese", desc:"2 steaks, 2 cheddars, cornichons", price:5.5, opts:burgerOpts()},
  {id:"bg-big", cat:"burger", name:"Big", desc:"2 steaks, crudités, 2 cheddars", price:6, opts:burgerOpts()},
  {id:"bg-deluxe", cat:"burger", name:"Deluxe", desc:"2 steaks, salade, tomate, 2 cheddars", price:6, opts:burgerOpts()},
  {id:"bg-chicken", cat:"burger", name:"Chicken", desc:"Poulet pané, cheddar, crudités", price:6.5, opts:burgerOpts()},
  {id:"bg-giant", cat:"burger", name:"Giant", desc:"2 steaks, 2 cheddars, salade, sauce giant, oignons", price:6.5, opts:burgerOpts()},
  {id:"bg-kiri", cat:"burger", name:"Kiri", desc:"2 steaks, 2 cheddars, salade, Kiri", price:6.5, opts:burgerOpts()},
  {id:"bg-bacon", cat:"burger", name:"Bacon", desc:"2 steaks, bacon, 2 cheddars", price:7, opts:burgerOpts()},
  {id:"bg-triple", cat:"burger", name:"Triple Burger", desc:"3 steaks, 3 cheddars, crudités", price:7.5, opts:burgerOpts()},
  // Tacos
  {id:"tacos", cat:"tacos", name:"Tacos", desc:"Frites, sauce fromagère maison, viande et sauce au choix. Simple, double ou XL.", price:7.5, badge:"Le plus commandé",
   opts:[
     {id:"taille", label:"Taille", type:"one", req:true, def:0, choices:[{n:"Simple · 1 viande", p:0},{n:"Double · 2 viandes", p:2},{n:"XL · 3 viandes", p:4}]},
     {id:"viandes", label:"Viandes", type:"many", exact:s => [1,2,3][(s.taille||[0])[0]], choices:ch(VIANDES)},
     {id:"sauces", label:"Sauces", hint:"2 max", type:"many", max:2, req:true, choices:ch(SAUCES)},
     G.gratine(), G.supp(), G.viandeSupp(),
     {id:"formule", label:"Formule", type:"one", req:true, def:0, choices:[{n:"Seul", p:0},{n:"En menu · frites + boisson", p:2.5}]},
     G.boissonMenu()
   ]},
  // Sandwichs
  {id:"sw-americain", cat:"sandwich", name:"Américain", desc:"Steak, crudités, cheddar", price:6, opts:sandOpts(2.5)},
  {id:"sw-texas", cat:"sandwich", name:"Texas", desc:"Steak, bacon, crudités, œuf, cheddar", price:7.9, opts:sandOpts(2)},
  {id:"sw-duo", cat:"sandwich", name:"Duo Boursin", desc:"Steak, escalope, crudités, Boursin, cheddar", price:7.9, opts:sandOpts(2)},
  {id:"sw-special", cat:"sandwich", name:"Le Spécial", desc:"Escalope, crudités, bacon, œuf, cheddar", price:7.9, opts:sandOpts(2)},
  {id:"sw-curry", cat:"sandwich", name:"Curry", desc:"Poulet curry, crudités, cheddar", price:7.9, opts:sandOpts(2)},
  {id:"sw-tandori", cat:"sandwich", name:"Tandori", desc:"Poulet tandoori, crudités, cheddar", price:7.9, opts:sandOpts(2)},
  {id:"sw-auth", cat:"sandwich", name:"L'Authentique", desc:"Escalope, crudités, cheddar", price:7.9, opts:sandOpts(2)},
  {id:"sw-mexico", cat:"sandwich", name:"Mexico", desc:"Escalope, poivrons rouges et verts, oignons cuits, salade, cheddar", price:7.9, opts:sandOpts(2)},
  // Wraps
  {id:"wr-tenders", cat:"wrap", name:"Wrap Tenders", desc:"Tenders de poulet croustillants", price:6, opts:sandOpts(2)},
  {id:"wr-chevre", cat:"wrap", name:"Wrap Chèvre", desc:"Chèvre fondant", price:6, opts:sandOpts(2)},
  {id:"wr-steak", cat:"wrap", name:"Wrap Steak", desc:"Steak haché", price:5.5, opts:sandOpts(2)},
  // Riz
  {id:"riz-crousty", cat:"riz", name:"Riz Tasty Crousty", desc:"Riz, poulet croustillant, sauces, oignons frits", price:9.9, opts:[G.formule(1,"Avec boisson"), G.boissonMenu()]},
  {id:"riz-curry", cat:"riz", name:"Riz Tasty Curry", desc:"Riz, poulet croustillant, sauce curry", price:9.9, opts:[G.formule(1,"Avec boisson"), G.boissonMenu()]},
  {id:"riz-boursin", cat:"riz", name:"Riz Poulet Boursin", desc:"Riz, poulet, crème au Boursin, ciboulette", price:10.9, opts:[G.formule(1,"Avec boisson"), G.boissonMenu()]},
  // Tex Mex
  {id:"tm-camembert", cat:"texmex", name:"Bouchées camembert", desc:"6 pièces", price:5.5, opts:burgerOpts()},
  {id:"tm-jalapenos", cat:"texmex", name:"Jalapeños", desc:"6 pièces", price:5.5, opts:burgerOpts()},
  {id:"tm-wings", cat:"texmex", name:"Wings", desc:"4 pièces", price:5.5, opts:burgerOpts()},
  {id:"tm-nuggets", cat:"texmex", name:"Nuggets", desc:"6 pièces", price:5.5, opts:burgerOpts()},
  {id:"tm-tenders", cat:"texmex", name:"Tenders", desc:"4 pièces", price:5.5, opts:burgerOpts()},
  {id:"tm-mozza", cat:"texmex", name:"Mozza sticks", desc:"6 pièces", price:5.5, opts:burgerOpts()},
  // Menus
  {id:"mn-duo", cat:"menus", name:"Burger Duo", desc:"2 burgers au choix, frites, boisson", price:11.9, opts:[
    {id:"b1", label:"1er burger", short:"Burger 1", type:"one", req:true, choices:ch(CLASSIC)},
    {id:"b2", label:"2e burger", short:"Burger 2", type:"one", req:true, choices:ch(CLASSIC)},
    {id:"boisson", label:"Boisson", type:"one", req:true, choices:ch(DRINKS)}]},
  {id:"mn-smashduo", cat:"menus", name:"Smash & Burger", desc:"1 smash, 1 burger, frites, boisson", price:14.9, opts:[
    {id:"s1", label:"Le smash", short:"Smash", type:"one", req:true, choices:ch(SMASHES)},
    {id:"b1", label:"Le burger", short:"Burger", type:"one", req:true, choices:ch(CLASSIC)},
    {id:"boisson", label:"Boisson", type:"one", req:true, choices:ch(DRINKS)}]},
  {id:"mn-etudiant", cat:"menus", name:"Menu Étudiant", desc:"Burger, frites et boisson, ou riz et boisson, ou tacos, frites et boisson (7 €)", price:6.5, badge:"Petit prix", opts:[
    {id:"plat", label:"Formule", type:"one", req:true, def:0, choices:[{n:"Burger + frites + boisson", p:0},{n:"Riz + boisson", p:0},{n:"Tacos + frites + boisson", p:0.5}]},
    {id:"burger", label:"Burger", type:"one", req:true, when:["plat",0], choices:ch(["Cheese","Chicken"])},
    {id:"riz", label:"Riz", type:"one", req:true, when:["plat",1], choices:ch(["Tasty Crousty","Tasty Curry"])},
    {id:"viande", label:"Viande du tacos", short:"Viande", type:"one", req:true, when:["plat",2], choices:ch(VIANDES)},
    {id:"sauces", label:"Sauces du tacos", short:"Sauces", hint:"2 max", type:"many", max:2, when:["plat",2], choices:ch(SAUCES)},
    {id:"boisson", label:"Boisson", type:"one", req:true, choices:ch(DRINKS)}]},
  {id:"mn-enfant", cat:"menus", name:"Menu Enfant", desc:"Nuggets ou cheeseburger, frites, compote ou Kinder, Capri-Sun", price:5, opts:[
    {id:"plat", label:"Plat", type:"one", req:true, choices:ch(["Nuggets","Cheeseburger"])},
    {id:"dessert", label:"Dessert", type:"one", req:true, choices:ch(["Compote","Kinder"])}]},
  {id:"mn-family", cat:"menus", name:"Menu Family", desc:"2 Big, 2 Giant, 1 grande frite, 6 nuggets, 1 bouteille 1,25 L", price:23, badge:"Pour 4", opts:[
    {id:"boisson", label:"Bouteille 1,25 L", short:"Bouteille", type:"one", req:true, choices:ch(["Coca-Cola","Coca-Cola Zéro","Fanta Orange","Ice Tea Pêche","Oasis Tropical"])}]},
  // Frites & salades
  {id:"fr-simple", cat:"frites", name:"Frites", desc:"Portion classique", price:2, opts:[]},
  {id:"fr-grande", cat:"frites", name:"Grande frite", desc:"Pour partager", price:3, opts:[]},
  {id:"fr-cheddar", cat:"frites", name:"Frites cheddar", desc:"Nappées de cheddar fondu", price:3.5, opts:[]},
  {id:"fr-bacon", cat:"frites", name:"Frites bacon-cheddar", desc:"Cheddar fondu et bacon", price:4.5, opts:[]},
  {id:"salade", cat:"frites", name:"Salade + boisson", desc:"Salade César ou salade au chèvre, avec une boisson", price:8.9, opts:[
    {id:"salade", label:"Salade", type:"one", req:true, choices:ch(["César","Chèvre"])},
    {id:"boisson", label:"Boisson", type:"one", req:true, choices:ch(DRINKS)}]},
  // Sweet
  {id:"milkshake", cat:"sweet", name:"Milkshake", desc:"Base vanille, banane, pop-corn ou fraise, avec un topping", price:4.9, opts:[
    {id:"parfum", label:"Parfum", type:"one", req:true, choices:ch(["Vanille","Banane","Pop-corn","Fraise"])},
    {id:"topping", label:"Topping", type:"one", req:true, choices:ch(["KitKat","Snickers","M&M's","Kinder Bueno","Kinder Bueno White","Bounty"])}]},
  {id:"tiramisu", cat:"sweet", name:"Tiramisu", desc:"Fait maison", price:3.9, opts:[], badge:"Fait maison"},
  {id:"tarte", cat:"sweet", name:"Tarte", desc:"Daim ou coco", price:3, opts:[{id:"parfum", label:"Parfum", type:"one", req:true, choices:ch(["Daim","Coco"])}]},
  {id:"barre", cat:"sweet", name:"Barre chocolatée", desc:"", price:1.5, opts:[{id:"barre", label:"Barre", type:"one", req:true, choices:ch(["KitKat","Snickers","Twix","Bounty","Kinder Bueno"])}]},
  {id:"kinder", cat:"sweet", name:"Kinder Surprise", desc:"", price:1.5, opts:[]},
  // Boissons
  {id:"canette", cat:"drink", name:"Canette 33 cl", desc:"", price:1.5, opts:[{id:"choix", label:"Boisson", type:"one", req:true, choices:ch(DRINKS.slice(0,7))}]},
  {id:"verre", cat:"drink", name:"Bouteille en verre", desc:"", price:2.5, opts:[{id:"choix", label:"Boisson", type:"one", req:true, choices:ch(["Coca-Cola","Orangina","Ice Tea Pêche"])}]},
  {id:"b15", cat:"drink", name:"Bouteille 1,5 L", desc:"", price:3, opts:[{id:"choix", label:"Boisson", type:"one", req:true, choices:ch(["Coca-Cola","Coca-Cola Zéro","Fanta Orange","Ice Tea Pêche","Oasis Tropical"])}]},
  {id:"b2", cat:"drink", name:"Bouteille 2 L", desc:"", price:3.5, opts:[{id:"choix", label:"Boisson", type:"one", req:true, choices:ch(["Coca-Cola","Fanta Orange","Oasis Tropical"])}]},
  {id:"eau", cat:"drink", name:"Cristaline", desc:"Eau plate 50 cl", price:1, opts:[]},
  {id:"cafe", cat:"drink", name:"Café", desc:"Expresso", price:1.5, opts:[]}
];
const byId = Object.fromEntries(ITEMS.map(i => [i.id, i]));


  return { ICON, CATS, ITEMS, byId, G, DRINKS, SAUCES };
})();

const mealConfig = {
  breakfast: { moods: [["sweet","Сладкое"],["savory","Несладкое"],["any","Неважно"]], bases: [["porridge","Каша"],["curd","Творог / йогурт"],["eggs","Яйца"],["sandwich","Тост / сэндвич"],["any","Неважно"]] },
  lunch: { moods: [["hearty","Сытное"],["fresh","Свежее"],["cozy","Тёплое домашнее"],["any","Неважно"]], bases: [["chicken","Курица / индейка"],["fish","Рыба"],["legumes","Бобовые"],["eggs","Яйца"],["any","Неважно"]] },
  dinner: { moods: [["light","Лёгкое"],["hearty","Сытное"],["fresh","Свежее"],["any","Неважно"]], bases: [["chicken","Курица / индейка"],["fish","Рыба"],["eggs","Яйца"],["legumes","Бобовые"],["curd","Творог"],["any","Неважно"]] },
  snack: { moods: [["sweet","Сладкое"],["savory","Несладкое"],["crunchy","Хрустящее"],["fresh","Свежее"],["any","Неважно"]], bases: [["fruit","Фрукты"],["curd","Творог / йогурт"],["eggs","Яйца"],["legumes","Бобовые"],["sandwich","Хлебцы / тост"],["nuts","Орехи"],["any","Неважно"]] }
};

const mealNames = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" };
const routeNames = { builder: "Подбор блюда", library: "Все рецепты", mine: "Моё", pairings: "К напитку", order: "Что заказать" };
const state = { meal: "breakfast", mood: "any", base: "any", veggie: "any", time: 20, results: [], portions: 1, orderMood: "any", drink: "white" };
const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
let saved = readStore("meal-builder-saved-v2", readStore("meal-builder-saved", []));
let customRecipes = readStore("meal-builder-custom-v1", []);
let collections = readStore("meal-builder-collections-v1", []);

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const allRecipes = () => [...RECIPES, ...customRecipes];
const recipeById = id => allRecipes().find(recipe => recipe.id === id);

const PAIRINGS = {
  white: { name: "Белое вино", rule: "Лёгкие белые вина дружат с рыбой, морепродуктами, птицей, свежими травами и сливочными соусами без тяжёлой сладости.", pairs: [
    ["Креветки и цитрус", "Рыба с лимоном и зеленью", ["креветки с йогуртовым соусом", "тост с мягким сыром", "оливки"]],
    ["Козий сыр и груша", "Курица с травами", ["зелёный салат", "брускетта с рикоттой", "миндаль"]],
    ["Лосось на огурце", "Паста с морепродуктами", ["огуречные канапе", "кальмар на гриле", "мягкий сыр"]]
  ]},
  red: { name: "Красное вино", rule: "Красное вино лучше выдерживает насыщенное мясо, грибы и запечённые блюда; танины особенно хорошо работают с жирностью.", pairs: [
    ["Выдержанный сыр", "Стейк и печёные овощи", ["твёрдый сыр", "орехи", "оливки"]],
    ["Брускетта с грибами", "Тушёная говядина", ["шампиньоны", "вяленые томаты", "хлеб"]],
    ["Рулетики из баклажана", "Грибное ризотто", ["баклажан", "творожный сыр", "зелень"]]
  ]},
  sparkling: { name: "Игристое", rule: "Кислотность и пузырьки освежают вкус, поэтому игристое хорошо работает с солёными, жареными и сливочными блюдами.", pairs: [
    ["Оливки и мягкий сыр", "Хрустящая курица с салатом", ["оливки", "бри", "виноград"]],
    ["Канапе с лососем", "Креветки в темпуре", ["слабосолёная рыба", "огурец", "творожный сыр"]],
    ["Сырные слойки", "Ризотто с лимоном", ["слоёное тесто", "сыр", "зелень"]]
  ]},
  rose: { name: "Розовое вино", rule: "Сухое розе обычно подходит к лёгкой птице, лососю, овощам на гриле и не слишком острой средиземноморской еде.", pairs: [
    ["Хумус и овощи", "Лосось с салатом", ["хумус", "огурец", "сладкий перец"]],
    ["Мягкий сыр и томаты", "Курица на гриле", ["моцарелла", "томаты", "базилик"]],
    ["Тапас с оливками", "Паста с овощами", ["оливки", "артишоки", "хлеб"]]
  ]},
  lager: { name: "Лагер или пилснер", rule: "Чистое, свежее пиво поддерживает солёные закуски, тесто, жареную рыбу и блюда средней насыщенности.", pairs: [
    ["Гренки и сырный соус", "Бургер с салатом", ["чесночные гренки", "сырный соус", "маринованный огурец"]],
    ["Сырные палочки", "Рыба с картофелем", ["моцарелла", "панировка", "томатный соус"]],
    ["Куриные крылья", "Колбаски и капуста", ["крылья", "соус", "свежие овощи"]]
  ]},
  ipa: { name: "IPA или светлый эль", rule: "Хмелевая горечь подходит к жирной и жареной еде, но может усиливать остроту — для очень острых блюд лучше более мягкий эль.", pairs: [
    ["Начос с гуакамоле", "Бургер с рваной говядиной", ["начос", "авокадо", "томатная сальса"]],
    ["Чеддер и орехи", "Пряные тако", ["чеддер", "миндаль", "оливки"]],
    ["Крылья барбекю", "Карри с рисом", ["куриные крылья", "соус барбекю", "овощные палочки"]]
  ]},
  cider: { name: "Сидр", rule: "Сухой сидр сочетает фруктовую кислотность и лёгкую сладость: ему идут свинина, мягкие сыры, морепродукты и блюда с яблоком.", pairs: [
    ["Запечённый камамбер", "Свинина с яблоком", ["камамбер", "яблоко", "хлеб"]],
    ["Сыр и чатни", "Гребешки или креветки", ["полутвёрдый сыр", "яблочный чатни", "крекеры"]],
    ["Брускетта с грушей", "Курица с корнеплодами", ["груша", "рикотта", "хлеб"]]
  ]},
  vermouth: { name: "Вермут", rule: "Вермут — аперитив: солёные и жирные закуски, оливки, анчоусы, орехи и морепродукты раскрывают его особенно хорошо.", pairs: [
    ["Оливки и солёные орехи", "Морепродукты с пастой", ["оливки", "миндаль", "твёрдый сыр"]],
    ["Тост с анчоусом", "Испанская тортилья", ["анчоусы", "хлеб", "томаты"]],
    ["Сырная тарелка", "Кальмар на гриле", ["мягкий сыр", "виноград", "крекеры"]]
  ]},
  gin: { name: "Джин-тоник", rule: "Можжевельник, цитрус и травы поддерживают огурец, лосось, креветки, свежую зелень и лёгкие пряные блюда.", pairs: [
    ["Огурец с лососем", "Курица с лимоном и травами", ["огурец", "лосось", "творожный сыр"]],
    ["Креветки с лаймом", "Белая рыба с зеленью", ["креветки", "лайм", "кинза"]],
    ["Козий сыр и зелень", "Овощное карри", ["козий сыр", "огурец", "базилик"]]
  ]},
  whisky: { name: "Виски", rule: "Дымные, древесные и карамельные ноты выдерживают стейк, копчёности, выдержанный сыр, грибы и не слишком сладкий десерт.", pairs: [
    ["Выдержанный сыр и орехи", "Стейк с грибами", ["чеддер", "грецкие орехи", "тёмный хлеб"]],
    ["Копчёный лосось", "Рёбра или ростбиф", ["лосось", "огурец", "ржаной тост"]],
    ["Грибы на тосте", "Говядина с печёным картофелем", ["шампиньоны", "хлеб", "тимьян"]]
  ]},
  zero: { name: "Без алкоголя", rule: "Тоник, безалкогольное игристое или комбуча дают кислотность и свежесть — к ним подходят те же лёгкие солёные закуски.", pairs: [
    ["Хумус и овощи", "Рыба с лимоном", ["хумус", "огурец", "сладкий перец"]],
    ["Мягкий сыр и виноград", "Курица с зелёным салатом", ["бри", "виноград", "орехи"]],
    ["Оливки и брускетта", "Овощная паста", ["оливки", "томаты", "хлеб"]]
  ]}
};

const ORDER_OPTIONS = [
  { title: "Роллы", moods: ["any","fresh"], detail: "Закажите один запечённый ролл, один свежий с лососем или креветкой и небольшую порцию эдамаме." },
  { title: "Бургер", moods: ["any","cheesy"], detail: "Выберите классический бургер с сыром, картофель по-деревенски и салат или овощные палочки." },
  { title: "Пицца", moods: ["any","cheesy"], detail: "Возьмите половину маргариты и половину с грибами или курицей — так выбор уже сделан, но вкусов будет два." },
  { title: "Шаурма", moods: ["any","fresh"], detail: "Закажите шаурму с курицей, большим количеством овощей и соусом отдельно." },
  { title: "Вок", moods: ["any","spicy"], detail: "Лапша удон с курицей или креветками, овощами и средне-острым соусом." },
  { title: "Хрустящая курица", moods: ["any","crunchy","spicy"], detail: "Куриные стрипсы, кукуруза или коул-слоу и один соус на выбор." },
  { title: "Тако", moods: ["any","spicy","fresh"], detail: "Два тако: один с говядиной, второй с фасолью или креветкой, плюс свежая сальса." },
  { title: "Фалафель", moods: ["any","crunchy","fresh"], detail: "Пита с фалафелем, хумусом и овощами; картофель можно заменить дополнительным салатом." },
  { title: "Хачапури", moods: ["any","cheesy"], detail: "Небольшой хачапури по-аджарски и салат из томатов с зеленью." },
  { title: "Корейская курица", moods: ["any","crunchy","spicy"], detail: "Хрустящая курица в остром соусе, рис и кимчи или огуречный салат." }
];

const els = {
  moodOptions: $("#moodOptions"), baseOptions: $("#baseOptions"), veggieOptions: $("#veggieOptions"), timeOptions: $("#timeOptions"),
  results: $("#results"), recipeGrid: $("#recipeGrid"), resultsSummary: $("#resultsSummary"), matchSummary: $("#matchSummary"),
  menuCount: $("#menuCount"), drawer: $("#menuDrawer"), overlay: $("#overlay"), savedMeals: $("#savedMeals"), shoppingList: $("#shoppingList"),
  dialog: $("#recipeDialog"), dialogContent: $("#dialogContent"), toast: $("#toast"), sidebar: $("#sidebar"), mobileTitle: $("#mobileTitle")
};

function renderChoiceGroup(container, items, key) {
  container.innerHTML = items.map(([value,label]) => `<button class="choice ${state[key] === value ? "active" : ""}" type="button" data-value="${value}">${label}</button>`).join("");
  container.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    state[key] = button.dataset.value;
    container.querySelectorAll("button").forEach(item => item.classList.toggle("active", item === button));
    updateMatchSummary();
  }));
}

function renderQuestions() {
  renderChoiceGroup(els.moodOptions, mealConfig[state.meal].moods, "mood");
  renderChoiceGroup(els.baseOptions, mealConfig[state.meal].bases, "base");
  updateMatchSummary();
}

function getExactMatches() {
  return RECIPES.filter(recipe => recipe.meal === state.meal && recipe.time <= state.time &&
    (state.mood === "any" || recipe.mood === state.mood) &&
    (state.base === "any" || recipe.base === state.base) &&
    (state.veggie === "any" || recipe.veggie === state.veggie));
}

function updateMatchSummary() {
  const count = getExactMatches().length;
  els.matchSummary.textContent = count ? `Точным условиям соответствуют ${count} ${count === 1 ? "блюдо" : count < 5 ? "блюда" : "блюд"}.` : "Точных совпадений пока нет — измените один из параметров.";
}

function shuffled(items) { return [...items].sort(() => Math.random() - .5); }

function suggestRecipes(scroll = true) {
  const matches = shuffled(getExactMatches());
  state.results = matches.slice(0, 3);
  renderResults(matches.length);
  els.results.classList.remove("hidden");
  if (scroll) els.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function recipeCard(recipe) {
  return `<article class="recipe-card"><div class="recipe-meta"><span class="pill">${recipe.time} мин</span><span class="pill">${mealNames[recipe.meal]}</span></div><h3>${escapeHtml(recipe.title)}</h3><p>${escapeHtml(recipe.note || "Сохранённый рецепт.")}</p><div class="card-actions"><button class="view-recipe" type="button" data-view-recipe="${recipe.id}">Рецепт</button><button class="add-meal" type="button" data-add="${recipe.id}" aria-label="Добавить в список">+</button></div></article>`;
}

function renderResults(total) {
  els.resultsSummary.textContent = total ? `Найдено ${total}. Показываем до трёх случайных вариантов.` : "Ничего постороннего не подставляем: измените один параметр.";
  els.recipeGrid.innerHTML = state.results.length ? state.results.map(recipeCard).join("") : `<div class="empty-state">Нет блюда, которое совпадает со всеми выбранными условиями. Попробуйте увеличить время или выбрать «Неважно» в одном из пунктов.</div>`;
  bindRecipeActions(els.recipeGrid);
}

function formatAmount(value) { return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100).replace(".",","); }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char])); }

function openRecipe(id) {
  const recipe = recipeById(id); if (!recipe) return;
  state.portions = 1;
  const paint = () => {
    els.dialogContent.innerHTML = `<div class="dialog-hero"><div class="recipe-meta"><span class="pill">${recipe.time} мин</span><span class="pill">${mealNames[recipe.meal]}</span></div><h2>${escapeHtml(recipe.title)}</h2><p>${escapeHtml(recipe.note || "Сохранённый рецепт.")}</p></div><div class="dialog-body"><section><h3>Продукты</h3><ul class="ingredient-list">${recipe.ingredients.map(([name,amount,unit]) => `<li>${escapeHtml(name)} — ${formatAmount(amount * state.portions)} ${escapeHtml(unit)}</li>`).join("")}</ul><div class="portion-row"><span>Порций:</span><button class="portion-button" id="lessPortion" type="button">−</button><strong>${state.portions}</strong><button class="portion-button" id="morePortion" type="button">+</button></div><button class="dialog-add" id="dialogAdd" type="button">Добавить в список</button></section><section><h3>Как приготовить</h3><ol class="step-list">${recipe.steps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol></section></div>`;
    $("#lessPortion").addEventListener("click", () => { state.portions = Math.max(1,state.portions-1); paint(); });
    $("#morePortion").addEventListener("click", () => { state.portions = Math.min(8,state.portions+1); paint(); });
    $("#dialogAdd").addEventListener("click", () => { addMeal(recipe.id,state.portions); els.dialog.close(); });
  };
  paint(); els.dialog.showModal();
}

function bindRecipeActions(root = document) {
  root.querySelectorAll("[data-view-recipe]").forEach(button => button.addEventListener("click", () => openRecipe(button.dataset.viewRecipe)));
  root.querySelectorAll("[data-add]").forEach(button => button.addEventListener("click", () => addMeal(button.dataset.add,1)));
}

function addMeal(id, portions) {
  const recipe = recipeById(id); if (!recipe) return;
  const existing = saved.find(item => item.id === id);
  if (existing) existing.portions += portions; else saved.push({ id, portions });
  persistSaved(); showToast("Добавлено в список");
}

function persistSaved() { localStorage.setItem("meal-builder-saved-v2",JSON.stringify(saved)); renderMenu(); }

function renderMenu() {
  saved = saved.filter(item => recipeById(item.id));
  els.menuCount.textContent = saved.length;
  if (!saved.length) {
    els.savedMeals.innerHTML = `<div class="empty-state">Добавьте блюда из подбора, библиотеки или своих рецептов.</div>`;
    els.shoppingList.innerHTML = `<li><span>Пока пусто</span><span>—</span></li>`;
    return;
  }
  els.savedMeals.innerHTML = saved.map((item,index) => { const recipe = recipeById(item.id); return `<article class="saved-card"><div><strong>${escapeHtml(recipe.title)}</strong><small>${item.portions} ${item.portions === 1 ? "порция" : "порции"}</small></div><button class="remove-saved" type="button" data-remove="${index}" aria-label="Удалить">×</button></article>`; }).join("");
  els.savedMeals.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => { saved.splice(Number(button.dataset.remove),1); persistSaved(); }));
  els.shoppingList.innerHTML = aggregateIngredients().map(item => `<li><span>${escapeHtml(item.name)}</span><span>${item.amounts.join(" + ")}</span></li>`).join("");
}

function aggregateIngredients() {
  const map = new Map();
  saved.forEach(item => { const recipe = recipeById(item.id); if (!recipe) return; recipe.ingredients.forEach(([name,amount,unit]) => { const key = `${name.toLowerCase()}|${unit}`; if (!map.has(key)) map.set(key,{name,unit,amount:0}); map.get(key).amount += Number(amount) * item.portions; }); });
  const byName = new Map();
  [...map.values()].forEach(item => { if (!byName.has(item.name)) byName.set(item.name,{name:item.name,amounts:[]}); byName.get(item.name).amounts.push(`${formatAmount(item.amount)} ${item.unit}`.trim()); });
  return [...byName.values()].sort((a,b) => a.name.localeCompare(b.name,"ru"));
}

function openMenu() { els.drawer.classList.add("open"); els.drawer.setAttribute("aria-hidden","false"); els.overlay.classList.remove("hidden"); document.body.style.overflow="hidden"; }
function closePanels() { els.drawer.classList.remove("open"); els.drawer.setAttribute("aria-hidden","true"); els.sidebar.classList.remove("open"); els.overlay.classList.add("hidden"); document.body.style.overflow=""; }
function showToast(message) { els.toast.textContent=message; els.toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer=setTimeout(() => els.toast.classList.remove("show"),1800); }

function navigate(route) {
  const safeRoute = routeNames[route] ? route : "builder";
  $$(".app-view").forEach(view => view.classList.toggle("active",view.dataset.view===safeRoute));
  $$(".nav-item").forEach(item => item.classList.toggle("active",item.dataset.route===safeRoute));
  els.mobileTitle.textContent=routeNames[safeRoute]; closePanels(); window.scrollTo({top:0,behavior:"smooth"});
  if (safeRoute === "library") renderLibrary(); if (safeRoute === "mine") renderMine();
}

function renderLibrary() {
  const query=$("#recipeSearch").value.trim().toLowerCase(); const meal=$("#libraryMeal").value;
  const list=allRecipes().filter(recipe => (meal==="any" || recipe.meal===meal) && (!query || `${recipe.title} ${recipe.note} ${recipe.ingredients.map(i=>i[0]).join(" ")}`.toLowerCase().includes(query)));
  $("#recipeTotal").textContent=allRecipes().length;
  $("#libraryList").innerHTML=list.length ? list.map(recipe => `<article class="library-row"><div><strong>${escapeHtml(recipe.title)}</strong><small>${mealNames[recipe.meal]} · ${recipe.time} мин</small></div><div class="library-actions"><button class="small-button" type="button" data-view-recipe="${recipe.id}">Открыть</button><button class="small-button" type="button" data-add="${recipe.id}">В список</button></div></article>`).join("") : `<div class="empty-state">По этому запросу ничего не найдено.</div>`;
  bindRecipeActions($("#libraryList"));
}

function parseIngredient(line) {
  const parts=line.split(/\s+[—-]\s+/); const name=(parts[0]||"Продукт").trim(); const tail=(parts[1]||"1 шт.").trim(); const match=tail.match(/^([\d.,]+)\s*(.*)$/); return [name,match ? Number(match[1].replace(",",".")) : 1,match ? (match[2]||"шт.") : tail];
}

function renderMine() {
  $("#customCount").textContent=customRecipes.length; $("#collectionCount").textContent=collections.length;
  $("#customRecipeList").innerHTML=customRecipes.length ? customRecipes.map(recipe => `<article class="compact-row"><div><strong>${escapeHtml(recipe.title)}</strong><small>${mealNames[recipe.meal]} · ${recipe.time} мин</small></div><div class="row-actions"><button type="button" data-view-recipe="${recipe.id}">Открыть</button><button type="button" data-add="${recipe.id}">В список</button><button class="remove" type="button" data-delete-custom="${recipe.id}">Удалить</button></div></article>`).join("") : `<div class="empty-state">Здесь появятся ваши рецепты.</div>`;
  bindRecipeActions($("#customRecipeList"));
  $("#customRecipeList").querySelectorAll("[data-delete-custom]").forEach(button => button.addEventListener("click", () => { customRecipes=customRecipes.filter(item=>item.id!==button.dataset.deleteCustom); saved=saved.filter(item=>item.id!==button.dataset.deleteCustom); persistCustom(); persistSaved(); renderMine(); }));
  $("#collectionList").innerHTML=collections.length ? collections.map((collection,index) => `<article class="compact-row"><div><strong>${escapeHtml(collection.name)}</strong><small>${collection.items.length} ${collection.items.length===1?"блюдо":"блюда"}</small></div><div class="row-actions"><button type="button" data-load-collection="${index}">Загрузить</button><button class="remove" type="button" data-delete-collection="${index}">Удалить</button></div></article>`).join("") : `<div class="empty-state">Сначала добавьте блюда в текущий список, затем сохраните его как подборку.</div>`;
  $("#collectionList").querySelectorAll("[data-load-collection]").forEach(button=>button.addEventListener("click",()=>{ saved=JSON.parse(JSON.stringify(collections[Number(button.dataset.loadCollection)].items)).filter(item=>recipeById(item.id)); persistSaved(); showToast("Подборка загружена"); }));
  $("#collectionList").querySelectorAll("[data-delete-collection]").forEach(button=>button.addEventListener("click",()=>{ collections.splice(Number(button.dataset.deleteCollection),1); persistCollections(); renderMine(); }));
}

function persistCustom(){ localStorage.setItem("meal-builder-custom-v1",JSON.stringify(customRecipes)); }
function persistCollections(){ localStorage.setItem("meal-builder-collections-v1",JSON.stringify(collections)); }

function renderPairings() {
  $("#drinkSelector").innerHTML=Object.entries(PAIRINGS).map(([id,item])=>`<button class="drink-button ${state.drink===id?"active":""}" type="button" data-drink="${id}">${item.name}</button>`).join("");
  $("#drinkSelector").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{state.drink=button.dataset.drink; renderPairings();}));
  const current=PAIRINGS[state.drink]; $("#pairingIntro").innerHTML=`<h2>${current.name}</h2><p>${current.rule}</p>`;
  $("#pairingResults").innerHTML=current.pairs.map((pair,index)=>`<article class="pairing-card"><span class="pair-label">Вариант ${index+1}</span><h3>${pair[0]}</h3><p>Ужин: ${pair[1]}</p><ul>${pair[2].map(item=>`<li>${item}</li>`).join("")}</ul></article>`).join("");
}

function randomOrder() {
  const pool=ORDER_OPTIONS.filter(option=>option.moods.includes(state.orderMood)); const choice=pool[Math.floor(Math.random()*pool.length)];
  $("#orderResult").innerHTML=`<div><h2>${choice.title}</h2><p class="order-detail">${choice.detail}</p><button class="secondary-button reroll" id="rerollOrder" type="button">Выбрать ещё раз</button></div>`;
  $("#rerollOrder").addEventListener("click",randomOrder);
}

$$('[data-meal]').forEach(button=>button.addEventListener("click",()=>{ state.meal=button.dataset.meal; state.mood="any"; state.base="any"; $$('[data-meal]').forEach(item=>item.classList.toggle("active",item===button)); renderQuestions(); els.results.classList.add("hidden"); }));
[[els.veggieOptions,"veggie"],[els.timeOptions,"time"]].forEach(([container,key])=>container.querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{ state[key]=key==="time"?Number(button.dataset.value):button.dataset.value; container.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button)); updateMatchSummary(); })));

$$('[data-route]').forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.route)));
$$('[data-route-link]').forEach(link=>link.addEventListener("click",event=>{event.preventDefault();navigate(link.dataset.routeLink);}));
$("#suggestButton").addEventListener("click",()=>suggestRecipes()); $("#rerollButton").addEventListener("click",()=>suggestRecipes(false));
$("#resetButton").addEventListener("click",()=>{Object.assign(state,{meal:"breakfast",mood:"any",base:"any",veggie:"any",time:20}); $$('[data-meal]').forEach(item=>item.classList.toggle("active",item.dataset.meal==="breakfast")); els.veggieOptions.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item.dataset.value==="any")); els.timeOptions.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item.dataset.value==="20")); els.results.classList.add("hidden"); renderQuestions();});
$("#menuButton").addEventListener("click",openMenu); $("#closeMenuButton").addEventListener("click",closePanels); els.overlay.addEventListener("click",closePanels); $("#mobileMenuButton").addEventListener("click",()=>{els.sidebar.classList.add("open");els.overlay.classList.remove("hidden");document.body.style.overflow="hidden";});
$("#closeDialogButton").addEventListener("click",()=>els.dialog.close()); $("#clearMenuButton").addEventListener("click",()=>{if(saved.length){saved=[];persistSaved();showToast("Список очищен");}});
$("#copyListButton").addEventListener("click",async()=>{if(!saved.length)return showToast("Список пока пуст");const text=aggregateIngredients().map(item=>`• ${item.name} — ${item.amounts.join(" + ")}`).join("\n");try{await navigator.clipboard.writeText(text);showToast("Список скопирован");}catch{showToast("Не получилось скопировать");}});
$("#recipeSearch").addEventListener("input",renderLibrary); $("#libraryMeal").addEventListener("change",renderLibrary);
$("#customRecipeForm").addEventListener("submit",event=>{event.preventDefault();const data=new FormData(event.currentTarget);const recipe={id:`custom-${Date.now()}`,title:data.get("title").trim(),meal:data.get("meal"),mood:"any",base:"any",veggie:"any",time:Number(data.get("time")),note:data.get("note").trim()||"Ваш сохранённый рецепт.",ingredients:data.get("ingredients").split("\n").map(s=>s.trim()).filter(Boolean).map(parseIngredient),steps:data.get("steps").split("\n").map(s=>s.trim()).filter(Boolean)};customRecipes.unshift(recipe);persistCustom();event.currentTarget.reset();event.currentTarget.elements.time.value=20;renderMine();renderLibrary();showToast("Рецепт сохранён");});
$("#collectionForm").addEventListener("submit",event=>{event.preventDefault();if(!saved.length)return showToast("Текущий список пуст");const data=new FormData(event.currentTarget);collections.unshift({name:data.get("name").trim(),items:JSON.parse(JSON.stringify(saved)),createdAt:new Date().toISOString()});persistCollections();event.currentTarget.reset();renderMine();showToast("Подборка сохранена");});
$("#exportButton").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({customRecipes,collections},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="my-menu-data.json";link.click();URL.revokeObjectURL(url);});
$("#importInput").addEventListener("change",async event=>{const file=event.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.customRecipes)||!Array.isArray(data.collections))throw new Error();customRecipes=data.customRecipes;collections=data.collections;persistCustom();persistCollections();renderMine();renderLibrary();showToast("Данные загружены");}catch{showToast("Файл не подходит");}event.target.value="";});
$("#orderMood").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{state.orderMood=button.dataset.orderMood;$("#orderMood").querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button));}));
$("#randomOrderButton").addEventListener("click",randomOrder);
document.addEventListener("keydown",event=>{if(event.key==="Escape")closePanels();});

renderQuestions(); renderMenu(); renderLibrary(); renderMine(); renderPairings();

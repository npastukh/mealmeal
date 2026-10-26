const mealConfig = {
  breakfast: { moods: [["sweet","Сладкое"],["savory","Несладкое"],["any","Неважно"]], bases: [["porridge","Каша"],["curd","Творог / йогурт"],["eggs","Яйца"],["sandwich","Тост / сэндвич"],["any","Неважно"]] },
  lunch: { moods: [["hearty","Сытное"],["fresh","Свежее"],["cozy","Тёплое домашнее"],["any","Неважно"]], bases: [["chicken","Курица / индейка"],["fish","Рыба"],["legumes","Бобовые"],["eggs","Яйца"],["any","Неважно"]] },
  dinner: { moods: [["light","Лёгкое"],["hearty","Сытное"],["fresh","Свежее"],["any","Неважно"]], bases: [["chicken","Курица / индейка"],["fish","Рыба"],["eggs","Яйца"],["legumes","Бобовые"],["curd","Творог"],["any","Неважно"]] },
  snack: { moods: [["sweet","Сладкое"],["savory","Несладкое"],["crunchy","Хрустящее"],["fresh","Свежее"],["any","Неважно"]], bases: [["fruit","Фрукты"],["curd","Творог / йогурт"],["eggs","Яйца"],["legumes","Бобовые"],["sandwich","Хлебцы / тост"],["nuts","Орехи"],["any","Неважно"]] }
};

const mealNames = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", snack: "Перекус" };
const mealIcons = { breakfast: "☀️", lunch: "🥗", dinner: "🍽️", snack: "🍎" }; // taste-skill-ignore: user requested restrained food emoji accents
const routeNames = { builder: "Подбор блюда", pantry: "Что есть дома", situations: "По ситуации", planner: "Меню на несколько дней", library: "Все рецепты", mine: "Моё", pairings: "К напитку", order: "Что заказать" };
const state = { meal: "breakfast", mood: "any", base: "any", veggie: "any", time: 20, results: [], portions: 1, orderMood: "any", orderCategories: [], drink: "white", pairingFormat: "snack", pairingEffort: "any", simpleBase: "eggs", simpleAddon: "freshveg", libraryFavoriteOnly: false, planDays: 3, planMode: "varied", activeSituation: "work" };
const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
let saved = readStore("meal-builder-saved-v2", readStore("meal-builder-saved", []));
let customRecipes = readStore("meal-builder-custom-v1", []);
let collections = readStore("meal-builder-collections-v1", []);
let favorites = readStore("meal-builder-favorites-v1", []);
let pantryItems = readStore("meal-builder-pantry-v1", []);
let leftoverItems = readStore("meal-builder-leftovers-v1", []);
let mealPlan = readStore("meal-builder-plan-v1", []);
let smartHistory = readStore("meal-builder-smart-history-v1", []);

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const allRecipes = () => [...RECIPES, ...customRecipes];
const recipeById = id => allRecipes().find(recipe => recipe.id === id);
const escapeHtml = value => String(value).replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
const shuffled = items => [...items].sort(() => Math.random() - .5);
const normalizeProduct = value => String(value).toLowerCase().replace(/ё/g,"е").replace(/\b(половина|половинка|готовая|готовый|вареный|вареная|замороженный|свежий|свежая)\b/g,"").replace(/[^а-яa-z\s-]/g," ").replace(/\s+/g," ").trim();
function canonicalProduct(value) {
  const normalized=normalizeProduct(value);
  for(const [group,aliases] of Object.entries(PRODUCT_GROUPS)) if(aliases.some(alias=>normalized.includes(normalizeProduct(alias)))) return group;
  return normalized.split(" ").filter(word=>word.length>2)[0]||normalized;
}
function productIdentity(value) {
  const normalized=normalizeProduct(value);
  for(const [group,aliases] of Object.entries(PRODUCT_GROUPS)) {
    const alias=aliases.find(item=>normalized.includes(normalizeProduct(item)));
    if(alias) return {group,alias:productAliasKey(group,alias),normalized};
  }
  const fallback=normalized.split(" ").filter(word=>word.length>2)[0]||normalized;
  return {group:fallback,alias:fallback,normalized};
}
function productAliasKey(group,alias) {
  const normalized=normalizeProduct(alias);
  if(group==="eggs") return "яйц";
  if(group==="freshveg"&&/^огур/.test(normalized)) return "огур";
  if(group==="freshveg"&&/помидор|томат/.test(normalized)) return "томат";
  if(group==="warmveg"&&/гриб|шампиньон/.test(normalized)) return "грибы";
  return normalized;
}
const GENERIC_PRODUCT_WORDS = {
  fish:["рыба","морепродукт"], chicken:["курица","индейка"], meat:["мясо","фарш"], bread:["хлеб"], cheese:["сыр"],
  rice:["рис"], grains:["крупа"], pasta:["макарон","паста"], legumes:["бобы"], vegetables:["овощи","овощная смесь"],
  freshveg:["свежие овощи"], warmveg:["замороженные овощи"], fruit:["фрукт"], berries:["ягода","ягоды"], nuts:["орех"], greens:["зелень"]
};
function isDirectProductMatch(stockItem,target) {
  return stockItem.identity.alias===target.alias;
}
function canSubstitute(have,target,recipe=null) {
  const generic=(GENERIC_PRODUCT_WORDS[target.group]||[]).map(normalizeProduct);
  if(have.group===target.group&&(generic.includes(have.normalized)||!["freshveg","warmveg","greens","pantry"].includes(target.group))) return true;
  if(have.group==="vegetables"&&["freshveg","warmveg"].includes(target.group)) return true;
  if((SUBSTITUTION_MATRIX[target.group]||[]).includes(have.group)) return true;
  const protein=["fish","chicken","meat","legumes"];
  const adaptable=recipe&&recipe.mood!=="sweet"&&/сэндвич|тост|ролл|лаваш|панини|бейгл|пита|салат|боул|паста|рис|гречк|макарон|картоф|овощ/i.test(recipe.title);
  return Boolean(adaptable&&protein.includes(have.group)&&protein.includes(target.group));
}
const productLabel=key=>PRODUCT_LABELS[key]||key;
const unique=items=>[...new Set(items)];

const SIMPLE_BASES = {
  eggs: { label: "Яйца", icon: "🥚", addons: { // taste-skill-ignore
    freshveg: ["Варёные яйца и свежие овощи", ["Яйца — 2 шт.", "Огурец — 1 шт.", "Помидор — 1 шт.", "Зелень"], "Отварите яйца 7–9 минут. Нарежьте овощи и выложите всё на одну тарелку."],
    plain: ["Варёные яйца", ["Яйца — 2 шт."], "Отварите яйца до желаемой плотности и охладите."],
    bacon: ["Яичница с беконом", ["Яйца — 2 шт.", "Бекон — 50 г"], "Подрумяньте бекон, разбейте сверху яйца и готовьте до плотного белка."],
    cheese: ["Омлет с сыром", ["Яйца — 2 шт.", "Сыр — 40 г", "Молоко — 30 мл"], "Взбейте яйца с молоком, вылейте на сковороду и добавьте сыр."],
    toast: ["Яйца и хрустящий тост", ["Яйца — 2 шт.", "Хлеб — 1 ломтик"], "Отварите или поджарьте яйца. Хлеб подсушите отдельно."],
    avocado: ["Яйца с авокадо", ["Яйца — 2 шт.", "Авокадо — 1/2 шт.", "Лимон"], "Отварите яйца, нарежьте авокадо и сбрызните его лимоном."],
    greens: ["Яйца со шпинатом", ["Яйца — 2 шт.", "Шпинат — 120 г"], "Прогрейте шпинат, добавьте яйца и перемешивайте до готовности."]
  }},
  porridge: { label: "Каша", icon: "🥣", addons: { // taste-skill-ignore
    plain: ["Обычная молочная каша", ["Хлопья — 50 г", "Молоко — 180 мл"], "Сварите хлопья на молоке 5–7 минут."],
    banana: ["Каша с бананом", ["Хлопья — 50 г", "Молоко — 180 мл", "Банан — 1 шт."], "Сварите кашу и вмешайте половину размятого банана. Остальной нарежьте сверху."],
    berries: ["Каша с ягодами", ["Хлопья — 50 г", "Молоко — 180 мл", "Ягоды — 100 г"], "Сварите кашу и добавьте ягоды перед подачей."],
    fruit: ["Каша с яблоком и корицей", ["Хлопья — 50 г", "Молоко — 180 мл", "Яблоко — 1 шт."], "Сварите кашу. Половину яблока прогрейте вместе с ней, вторую добавьте свежей."],
    nuts: ["Каша с орехами и мёдом", ["Хлопья — 50 г", "Молоко — 180 мл", "Орехи — 20 г", "Мёд — 1 ч. л."], "Сварите кашу, добавьте орехи и мёд."]
  }},
  curd: { label: "Творог", icon: "🥛", addons: { // taste-skill-ignore
    berries: ["Творог с ягодами", ["Творог — 180 г", "Ягоды — 100 г", "Йогурт — 1 ст. л."], "Смешайте творог с йогуртом и добавьте ягоды."],
    fruit: ["Творог с фруктами", ["Творог — 180 г", "Яблоко или груша — 1 шт."], "Нарежьте фрукт и добавьте к творогу."],
    honey: ["Творог с мёдом и орехами", ["Творог — 180 г", "Мёд — 1 ч. л.", "Орехи — 15 г"], "Добавьте к творогу мёд и рубленые орехи."],
    freshveg: ["Несладкий творог и овощи", ["Творог — 180 г", "Огурец — 1 шт.", "Редис — 4 шт."], "Смешайте творог с зеленью, овощи нарежьте и подайте рядом."],
    toast: ["Творог на тосте", ["Творог — 140 г", "Хлеб — 2 ломтика", "Зелень"], "Подсушите хлеб и выложите сверху творог с зеленью."]
  }},
  yogurt: { label: "Йогурт", icon: "🥄", addons: { // taste-skill-ignore
    berries: ["Йогурт с ягодами и гранолой", ["Йогурт — 180 г", "Ягоды — 100 г", "Гранола — 30 г"], "Соберите всё слоями в миске."],
    banana: ["Йогурт с бананом", ["Йогурт — 180 г", "Банан — 1 шт."], "Нарежьте банан и добавьте к йогурту."],
    fruit: ["Йогурт с яблоком и корицей", ["Йогурт — 180 г", "Яблоко — 1 шт.", "Корица"], "Нарежьте яблоко, смешайте с йогуртом и корицей."],
    nuts: ["Йогурт с орехами", ["Йогурт — 180 г", "Орехи — 20 г", "Мёд — 1 ч. л."], "Добавьте орехи и немного мёда."]
  }},
  pancakes: { label: "Блины", icon: "🥞", addons: { // taste-skill-ignore
    fruit: ["Блины с тёплым яблоком", ["Блины — 2 шт.", "Яблоко — 1 шт.", "Корица"], "Прогрейте яблоко с корицей и заверните в блины."],
    berries: ["Блины с ягодами и йогуртом", ["Блины — 2 шт.", "Ягоды — 100 г", "Йогурт — 2 ст. л."], "Прогрейте блины и подайте с ягодами и йогуртом."],
    curd: ["Блины с творогом", ["Блины — 2 шт.", "Творог — 140 г", "Сметана — 1 ст. л."], "Заверните творог в блины и прогрейте на сковороде."],
    cheese: ["Блины с сыром", ["Блины — 2 шт.", "Сыр — 60 г"], "Добавьте сыр, сверните блины и прогрейте до его плавления."],
    bacon: ["Блины с ветчиной и сыром", ["Блины — 2 шт.", "Ветчина — 60 г", "Сыр — 50 г"], "Заверните начинку в блины и подрумяньте с двух сторон."]
  }},
  syrniki: { label: "Сырники", icon: "🧀", addons: { // taste-skill-ignore
    plain: ["Классические сырники", ["Творог — 180 г", "Яйцо — 1 шт.", "Мука — 25 г"], "Смешайте продукты, сформируйте сырники и обжарьте с двух сторон."],
    berries: ["Сырники с ягодами", ["Сырники — 3 шт.", "Ягоды — 100 г", "Йогурт — 1 ст. л."], "Подогрейте сырники и добавьте ягоды с йогуртом."],
    fruit: ["Сырники с печёным яблоком", ["Сырники — 3 шт.", "Яблоко — 1 шт.", "Корица"], "Запеките или прогрейте яблоко с корицей и подайте к сырникам."],
    honey: ["Сырники с йогуртом и мёдом", ["Сырники — 3 шт.", "Йогурт — 2 ст. л.", "Мёд — 1 ч. л."], "Подогрейте сырники и добавьте йогурт с мёдом."]
  }},
  chicken: { label: "Курица", icon: "🍗", addons: { // taste-skill-ignore
    freshveg: ["Курица и свежий салат", ["Готовая курица — 150 г", "Огурец — 1 шт.", "Помидор — 1 шт."], "Нарежьте продукты и соберите на одной тарелке."],
    rice: ["Курица с рисом", ["Куриное филе — 160 г", "Рис — 70 г"], "Отварите рис и обжарьте кусочки курицы."],
    pasta: ["Курица с макаронами", ["Куриное филе — 150 г", "Макароны — 80 г"], "Отварите макароны и обжарьте курицу на сковороде."],
    potato: ["Курица с картофелем", ["Куриное филе — 160 г", "Картофель — 250 г"], "Нарежьте продукты и запекайте вместе 30 минут при 200 °C."]
  }},
  fish: { label: "Рыба", icon: "🐟", addons: { // taste-skill-ignore
    freshveg: ["Рыба и свежие овощи", ["Готовая рыба — 170 г", "Огурец — 1 шт.", "Помидор — 1 шт."], "Подогрейте рыбу, овощи нарежьте и подайте рядом."],
    rice: ["Рыба с рисом", ["Белая рыба — 180 г", "Рис — 70 г", "Лимон"], "Отварите рис, рыбу обжарьте или запеките и добавьте лимон."],
    potato: ["Рыба с картофелем", ["Белая рыба — 180 г", "Картофель — 250 г"], "Запеките рыбу и картофель в одной форме."],
    greens: ["Лосось со шпинатом", ["Лосось — 170 г", "Шпинат — 150 г"], "Обжарьте лосось, затем быстро прогрейте шпинат на той же сковороде."]
  }},
  fruit: { label: "Фрукты", icon: "🍓", addons: { // taste-skill-ignore
    yogurt: ["Фрукты с йогуртом и гранолой", ["Фрукты — 200 г", "Йогурт — 140 г", "Гранола — 30 г"], "Нарежьте фрукты и соберите всё слоями."],
    nuts: ["Фрукты с ореховой пастой", ["Яблоко или банан — 1 шт.", "Ореховая паста — 1 ст. л."], "Нарежьте фрукт и подайте с ореховой пастой."],
    cheese: ["Виноград, груша и сыр", ["Виноград — 100 г", "Груша — 1 шт.", "Сыр — 50 г"], "Нарежьте грушу и сыр, добавьте виноград."],
    curd: ["Фрукты с творожным кремом", ["Фрукты — 180 г", "Творог — 120 г", "Йогурт — 1 ст. л."], "Взбейте творог с йогуртом и подайте с фруктами."]
  }}
};

const ADDON_LABELS = { freshveg:"Свежие овощи", plain:"Без добавок", bacon:"Бекон / ветчина", cheese:"Сыр", toast:"Тост", avocado:"Авокадо", greens:"Зелень / шпинат", banana:"Банан", berries:"Ягоды", fruit:"Фрукты", nuts:"Орехи", honey:"Мёд", curd:"Творог", rice:"Рис", pasta:"Макароны", potato:"Картофель", yogurt:"Йогурт" };

const PRODUCT_GROUPS = {
  fish: ["рыба","лосось","семга","сёмга","тунец","треска","кревет","морепродукт","кальмар","анчоус"],
  chicken: ["курица","куриное","куриный","индейка","индейки"],
  meat: ["мясо","говядина","ростбиф","ветчина","бекон","свинина","фарш","колбас"],
  eggs: ["яйцо","яйца","яичный"],
  bread: ["хлеб","тост","бейгл","чиабатта","пита","лаваш","тортилья","крекер","хлебцы"],
  cheese: ["сыр","чеддер","моцарелла","бри","пармезан","рикотта","фета","грюйер","манчего"],
  yogurt: ["йогурт","кефир"],
  curd: ["творог","творожный"],
  sourcream: ["сметана","сливки","молоко"],
  rice: ["рис","кускус","булгур","киноа"],
  grains: ["гречка","овсян","хлопья","пшено","манная","крупа"],
  pasta: ["макарон","паста","лапша","удон"],
  potato: ["картофель","картошка"],
  legumes: ["фасоль","нут","бобы","эдамаме","чечевица"],
  freshveg: ["огурец","огурцы","помидор","томат","редис","салат","руккола","капуста","сладкий перец","авокадо"],
  warmveg: ["брокколи","кабачок","баклажан","шпинат","морковь","грибы","шампиньоны","замороженные овощи"],
  vegetables: ["овощи","овощная смесь"],
  fruit: ["фрукт","яблоко","груша","банан","апельсин","персик","виноград","манго"],
  berries: ["ягода","ягоды","клубника","малина","черника"],
  nuts: ["орех","миндаль","фисташ","арахис"],
  greens: ["зелень","укроп","петрушка","базилик","кинза"],
  pantry: ["масло","мука","сахар","мёд","мед","соль","специи","соус","горчица"]
};
const PRODUCT_LABELS = { fish:"рыба", chicken:"курица или индейка", meat:"мясо или ветчина", eggs:"яйца", bread:"хлеб или лаваш", cheese:"сыр", yogurt:"йогурт или кефир", curd:"творог", sourcream:"молочное", rice:"рис или другая крупа", grains:"крупа", pasta:"макароны", potato:"картофель", legumes:"бобовые", freshveg:"свежие овощи", warmveg:"овощи для готовки", vegetables:"овощи", fruit:"фрукты", berries:"ягоды", nuts:"орехи", greens:"зелень", pantry:"базовые продукты" };
const SUBSTITUTION_MATRIX = {
  yogurt:["sourcream","curd"], sourcream:["yogurt","curd"], curd:["yogurt","sourcream","cheese"], cheese:["curd"],
  rice:["grains","pasta","potato"], grains:["rice","pasta","potato"], pasta:["rice","grains","potato"], potato:["rice","grains","pasta"],
  fruit:["berries"], berries:["fruit"]
};
const DISPLAY_ALTERNATIVES = {
  fish:["тунец или другая рыба","курица или индейка"], chicken:["индейка","рыба","бобовые"], meat:["курица или индейка","рыба"],
  bread:["лаваш","хлебцы"], cheese:["творожный сыр","творог"], yogurt:["сметана","кефир"], sourcream:["йогурт","молоко"], curd:["густой йогурт","рикотта"],
  rice:["гречка","булгур","макароны"], grains:["рис","пшено","другая крупа"], pasta:["рис","гречка","картофель"], potato:["рис","гречка","макароны"],
  legumes:["нут","фасоль","чечевица"], freshveg:["другие свежие овощи","замороженная смесь для горячего блюда"], warmveg:["замороженная овощная смесь","свежие овощи"],
  fruit:["ягоды","любой сезонный фрукт"], berries:["яблоко или груша","замороженные ягоды"], nuts:["семечки","ореховая паста"], greens:["любая свежая зелень"]
};
const QUICK_PRODUCT_SUGGESTIONS = ["яйца","курица","рыба","творог","сыр","хлеб","рис","гречка","макароны","картофель","огурцы","помидоры","замороженные овощи","яблоки","бананы"];

const SITUATIONS = [
  { id:"work", icon:"⏱️", title:"Перед работой", note:"До 10 минут", test:r=>r.meal==="breakfast"&&r.time<=10 }, // taste-skill-ignore
  { id:"takeaway", icon:"👜", title:"Взять с собой", note:"Сэндвичи, роллы и боулы", test:r=>r.time<=20&&/сэндвич|тост|ролл|лаваш|боул|панини|бейгл/i.test(r.title) }, // taste-skill-ignore
  { id:"batch", icon:"🍲", title:"На два дня", note:"Супы, запеканки и большие блюда", test:r=>["lunch","dinner"].includes(r.meal)&&r.time>=20&&/суп|запек|паста|куриц|индейк|гречк|рис/i.test(r.title) }, // taste-skill-ignore
  { id:"guests", icon:"🍽️", title:"Для гостей", note:"Можно красиво подать", test:r=>r.time>=15&&/лосось|кревет|ростбиф|капрезе|ризотто|крок|рулет|маффин|вафл/i.test(r.title) }, // taste-skill-ignore
  { id:"movie", icon:"🎬", title:"К фильму", note:"Хрустящее и порционное", test:r=>r.meal==="snack"&&(r.mood==="crunchy"||/шарик|палоч|мини|ролл|печень|нут/i.test(r.title)) }, // taste-skill-ignore
  { id:"recovery", icon:"☕", title:"Плотный завтрак", note:"Яйца, тосты и горячее", test:r=>r.meal==="breakfast"&&r.mood==="savory"&&(r.base==="eggs"||r.base==="sandwich") }, // taste-skill-ignore
  { id:"sweet", icon:"🍓", title:"Хочется сладкого", note:"Сырники, блины и фрукты", test:r=>r.mood==="sweet" }, // taste-skill-ignore
  { id:"crunchy", icon:"🥨", title:"Хочется хрустящего", note:"Без случайных мягких блюд", test:r=>r.mood==="crunchy"||/хруст|тост|панини|гренк/i.test(r.title) }, // taste-skill-ignore
  { id:"light", icon:"🌿", title:"Лёгкий ужин", note:"Рыба, овощи и свежие блюда", test:r=>r.meal==="dinner"&&["light","fresh"].includes(r.mood) }, // taste-skill-ignore
  { id:"hearty", icon:"🥘", title:"Сытная домашняя еда", note:"Тёплое и понятное", test:r=>["lunch","dinner"].includes(r.meal)&&["hearty","cozy"].includes(r.mood) } // taste-skill-ignore
];

const PAIRINGS = {
  white: { name:"Белое вино", icon:"🥂", pairs:[ // taste-skill-ignore
    ["Совиньон-блан и козий сыр", "Рыба с лимоном и зеленью", ["козий сыр", "груша", "миндаль"]],
    ["Шардоне и бри", "Паста с морепродуктами", ["бри", "крекеры", "виноград"]],
    ["Креветки с цитрусом", "Курица с травами", ["креветки", "лайм", "йогуртовый соус"]]
  ]},
  red: { name:"Красное вино", icon:"🍷", pairs:[ // taste-skill-ignore
    ["Каберне и выдержанный чеддер", "Стейк с печёными овощами", ["чеддер", "грецкие орехи", "оливки"]],
    ["Пино нуар и грюйер", "Грибное ризотто", ["грюйер", "грибы", "хлеб"]],
    ["Риоха и манчего", "Тушёная говядина", ["манчего", "вяленые томаты", "миндаль"]]
  ]},
  sparkling: { name:"Игристое", icon:"✨", pairs:[ // taste-skill-ignore
    ["Бри или камамбер", "Креветки в темпуре", ["бри", "виноград", "крекеры"]],
    ["Канапе с лососем", "Хрустящая курица с салатом", ["лосось", "огурец", "творожный сыр"]],
    ["Пармезан и оливки", "Лимонное ризотто", ["пармезан", "оливки", "гриссини"]]
  ]},
  rose: { name:"Розовое вино", icon:"🌸", pairs:[ // taste-skill-ignore
    ["Моцарелла и томаты", "Лосось с салатом", ["моцарелла", "томаты", "базилик"]],
    ["Хумус и овощи", "Курица на гриле", ["хумус", "огурец", "сладкий перец"]],
    ["Фета и оливки", "Паста с овощами", ["фета", "оливки", "артишоки"]]
  ]},
  lager: { name:"Лагер", icon:"🍺", pairs:[ // taste-skill-ignore
    ["Гренки и сырный соус", "Бургер с салатом", ["чесночные гренки", "чеддер", "маринованный огурец"]],
    ["Сырные палочки", "Рыба с картофелем", ["моцарелла", "панировка", "томатный соус"]],
    ["Куриные крылья", "Колбаски с капустой", ["крылья", "соус", "овощные палочки"]]
  ]},
  ipa: { name:"IPA / эль", icon:"🌿", pairs:[ // taste-skill-ignore
    ["Начос и гуакамоле", "Бургер с рваной говядиной", ["начос", "авокадо", "томатная сальса"]],
    ["Чеддер и орехи", "Пряный бургер с курицей", ["чеддер", "миндаль", "оливки"]],
    ["Крылья барбекю", "Карри с рисом", ["куриные крылья", "соус барбекю", "овощи"]]
  ]},
  cider: { name:"Сидр", icon:"🍏", pairs:[ // taste-skill-ignore
    ["Запечённый камамбер", "Свинина с яблоком", ["камамбер", "яблоко", "хлеб"]],
    ["Сыр и яблочный чатни", "Креветки на гриле", ["полутвёрдый сыр", "чатни", "крекеры"]],
    ["Брускетта с грушей", "Курица с корнеплодами", ["груша", "рикотта", "хлеб"]]
  ]},
  vermouth: { name:"Вермут", icon:"🍸", pairs:[ // taste-skill-ignore
    ["Оливки и солёный миндаль", "Паста с морепродуктами", ["оливки", "миндаль", "пармезан"]],
    ["Тост с анчоусом", "Испанская тортилья", ["анчоусы", "хлеб", "томаты"]],
    ["Манчего и хамон", "Кальмар на гриле", ["манчего", "хамон", "крекеры"]]
  ]},
  gin: { name:"Джин-тоник", icon:"🍋", pairs:[ // taste-skill-ignore
    ["Огурец с лососем", "Курица с лимоном", ["огурец", "лосось", "творожный сыр"]],
    ["Креветки с лаймом", "Белая рыба с зеленью", ["креветки", "лайм", "кинза"]],
    ["Козий сыр и зелень", "Овощное карри", ["козий сыр", "огурец", "базилик"]]
  ]},
  whisky: { name:"Виски", icon:"🥃", pairs:[ // taste-skill-ignore
    ["Выдержанный сыр и орехи", "Стейк с грибами", ["чеддер", "грецкие орехи", "тёмный хлеб"]],
    ["Копчёный лосось", "Рёбра или ростбиф", ["лосось", "огурец", "ржаной тост"]],
    ["Грибы на тосте", "Говядина с картофелем", ["шампиньоны", "хлеб", "тимьян"]]
  ]},
  zero: { name:"Без алкоголя", icon:"🫧", pairs:[ // taste-skill-ignore
    ["Хумус и овощи", "Рыба с лимоном", ["хумус", "огурец", "сладкий перец"]],
    ["Мягкий сыр и виноград", "Курица с зелёным салатом", ["бри", "виноград", "орехи"]],
    ["Оливки и брускетта", "Овощная паста", ["оливки", "томаты", "хлеб"]]
  ]}
};

const ORDER_CATEGORY_INFO = {
  rolls:["Роллы","🍣"], burger:["Бургеры","🍔"], pizza:["Пицца","🍕"], shawarma:["Шаурма","🌯"], wok:["Вок","🍜"], chicken:["Курица","🍗"], dumplings:["Пельмени и вареники","🥟"], steak:["Мясо на гриле","🥩"], georgian:["Грузинское","🧀"], ramen:["Рамен","🍲"], poke:["Поке","🥢"], pasta:["Паста","🍝"] // taste-skill-ignore
};
const ORDER_OPTIONS = [
  ["rolls","Классический сет",["any","fresh"],"Филадельфия, ролл с креветкой и огурцом, эдамаме."],
  ["rolls","Запечённые роллы",["any","cheesy"],"Запечённый ролл с лососем, ролл с крабом и небольшой салат чука."],
  ["rolls","Темпура-сет",["any","crunchy"],"Ролл с креветкой темпура, хрустящий ролл с лососем и соус спайси."],
  ["burger","Классический чизбургер",["any","cheesy"],"Говяжья котлета, чеддер, овощи и картофель по-деревенски."],
  ["burger","Криспи-чикен бургер",["any","crunchy"],"Хрустящая курица, коул-слоу и соус, без второго гарнира."],
  ["burger","Бургер с грибами",["any","cheesy"],"Говяжья котлета, грибы, сыр и небольшой зелёный салат."],
  ["pizza","Маргарита и грибы",["any","cheesy"],"Пицца половина маргарита, половина грибы и трюфельный соус."],
  ["pizza","Пепперони",["any","spicy"],"Небольшая пепперони, чесночный соус и овощной салат."],
  ["pizza","Четыре сыра",["any","cheesy"],"Небольшая пицца четыре сыра и руккола с томатами."],
  ["shawarma","Шаурма с курицей",["any","fresh"],"Курица, много овощей, маринованный огурец и соус отдельно."],
  ["shawarma","Шаурма с индейкой",["any","fresh"],"Индейка, свежие овощи, зелень и соус отдельно."],
  ["wok","Удон с курицей",["any","spicy"],"Удон, курица, овощи и средне-острый соус."],
  ["wok","Рис с креветками",["any","fresh"],"Жареный рис, креветки, яйцо и овощи."],
  ["chicken","Куриные стрипсы",["any","crunchy"],"Стрипсы, коул-слоу и один соус."],
  ["chicken","Корейская курица",["any","crunchy","spicy"],"Хрустящая курица в остром соусе, рис и огуречный салат."],
  ["dumplings","Пельмени со сметаной",["any"],"Порция домашних пельменей, сметана и зелень."],
  ["dumplings","Вареники с картофелем",["any"],"Вареники с картофелем, жареный лук и сметана."],
  ["steak","Стейк и овощи гриль",["any"],"Стейк средней прожарки, овощи гриль и перечный соус."],
  ["steak","Шашлык из курицы",["any","fresh"],"Куриный шашлык, лаваш, свежие овощи и соус отдельно."],
  ["georgian","Хачапури и салат",["any","cheesy"],"Небольшой хачапури по-аджарски и салат из томатов."],
  ["georgian","Хинкали",["any"],"Пять хинкали с говядиной или сыром и зеленью."],
  ["ramen","Рамен с курицей",["any","spicy"],"Бульон, лапша, курица, яйцо и кукуруза."],
  ["ramen","Мисо-рамен",["any"],"Мисо-бульон, лапша, грибы, тофу и яйцо."],
  ["poke","Поке с лососем",["any","fresh"],"Лосось, рис, авокадо, огурец и эдамаме."],
  ["poke","Поке с креветкой",["any","fresh"],"Креветка, рис, манго, огурец и салат чука."],
  ["pasta","Карбонара",["any","cheesy"],"Классическая карбонара и зелёный салат."],
  ["pasta","Томатная паста",["any","fresh"],"Паста с томатами, базиликом и пармезаном."]
].map(([category,title,moods,detail]) => ({category,title,moods,detail}));

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
  renderQuickList();
}

function getExactMatches() {
  return RECIPES.filter(recipe => recipe.meal === state.meal && recipe.time <= state.time &&
    (state.mood === "any" || recipe.mood === state.mood) &&
    (state.base === "any" || recipe.base === state.base) &&
    (state.veggie === "any" || recipe.veggie === state.veggie));
}

function updateMatchSummary() {
  const count = getExactMatches().length;
  els.matchSummary.textContent = count ? `${count} ${count === 1 ? "точный вариант" : count < 5 ? "точных варианта" : "точных вариантов"}` : "Нет точных совпадений — измените один параметр";
}

function renderQuickList() {
  const pool = RECIPES.filter(recipe => recipe.meal === state.meal && recipe.simpleBase && recipe.time <= 10);
  const items = shuffled(pool).slice(0, 4);
  $("#quickList").innerHTML = items.map(recipe => `<button class="quick-row" type="button" data-view-recipe="${recipe.id}"><span class="quick-icon">${mealIcons[recipe.meal]}</span><span><strong>${escapeHtml(recipe.title)}</strong><small>${recipe.time} минут</small></span><b>↗</b></button>`).join("");
  bindRecipeActions($("#quickList"));
}

function suggestRecipes(scroll = true) {
  state.results = getExactMatches();
  renderResults();
  els.results.classList.remove("hidden");
  if (scroll) els.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function recipeCard(recipe) {
  return `<article class="recipe-card"><div class="recipe-card-top"><span class="food-icon">${mealIcons[recipe.meal]}</span><div class="recipe-meta"><span class="pill">${recipe.time} мин</span><span class="pill">${mealNames[recipe.meal]}</span></div></div><h3>${escapeHtml(recipe.title)}</h3><p>${escapeHtml(recipe.note || "Сохранённый рецепт.")}</p><div class="card-actions"><button class="favorite-button ${favorites.includes(recipe.id)?"active":""}" type="button" data-favorite="${recipe.id}">${favorites.includes(recipe.id)?"Любимое":"Сохранить"}</button><button class="view-recipe" type="button" data-view-recipe="${recipe.id}">Открыть рецепт</button><button class="add-meal" type="button" data-add="${recipe.id}" aria-label="Добавить в список">+</button></div></article>`;
}

function renderResults() {
  els.resultsSummary.textContent = "";
  els.recipeGrid.innerHTML = state.results.length ? state.results.map(recipeCard).join("") : `<div class="empty-state">Увеличьте время или выберите «Неважно» в одном из пунктов.</div>`;
  bindRecipeActions(els.recipeGrid);
}

function renderSimpleComposer() {
  $("#simpleBaseOptions").innerHTML = Object.entries(SIMPLE_BASES).map(([id,item]) => `<button class="simple-chip ${state.simpleBase === id ? "active" : ""}" type="button" data-simple-base="${id}"><span>${item.icon}</span>${item.label}</button>`).join("");
  $("#simpleBaseOptions").querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    state.simpleBase = button.dataset.simpleBase;
    const keys = Object.keys(SIMPLE_BASES[state.simpleBase].addons);
    if (!keys.includes(state.simpleAddon)) state.simpleAddon = keys[0];
    renderSimpleComposer();
  }));
  const current = SIMPLE_BASES[state.simpleBase];
  $("#simpleAddonOptions").innerHTML = Object.keys(current.addons).map(id => `<button class="simple-chip ${state.simpleAddon === id ? "active" : ""}" type="button" data-simple-addon="${id}">${ADDON_LABELS[id]}</button>`).join("");
  $("#simpleAddonOptions").querySelectorAll("button").forEach(button => button.addEventListener("click", () => { state.simpleAddon = button.dataset.simpleAddon; renderSimpleComposer(); }));
  const result = current.addons[state.simpleAddon];
  $("#simpleResult").innerHTML = `<div class="simple-result-icon">${current.icon}</div><div class="simple-result-copy"><span>Готовый вариант</span><h3>${result[0]}</h3><p>${result[2]}</p></div><ul>${result[1].map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function persistKitchen() {
  localStorage.setItem("meal-builder-pantry-v1",JSON.stringify(pantryItems));
  localStorage.setItem("meal-builder-leftovers-v1",JSON.stringify(leftoverItems));
}
function addKitchenItems(value,target) {
  const items=value.split(/[,;\n]+/).map(item=>item.trim()).filter(Boolean);
  if(!items.length) return;
  if(target==="pantry") pantryItems=unique([...pantryItems,...items]); else leftoverItems=unique([...leftoverItems,...items]);
  persistKitchen(); renderPantry();
}
function renderPantry() {
  $("#pantryCount").textContent=pantryItems.length; $("#leftoverCount").textContent=leftoverItems.length;
  const chips=(items,type)=>items.length?items.map((item,index)=>`<button class="ingredient-chip" type="button" data-remove-kitchen="${type}:${index}">${escapeHtml(item)}<span>×</span></button>`).join(""):`<span class="chips-empty">Пока ничего</span>`;
  $("#pantryChips").innerHTML=chips(pantryItems,"pantry"); $("#leftoverChips").innerHTML=chips(leftoverItems,"leftover");
  $$("[data-remove-kitchen]").forEach(button=>button.addEventListener("click",()=>{const [type,index]=button.dataset.removeKitchen.split(":");if(type==="pantry")pantryItems.splice(Number(index),1);else leftoverItems.splice(Number(index),1);persistKitchen();renderPantry();}));
  $("#quickProducts").innerHTML=QUICK_PRODUCT_SUGGESTIONS.filter(item=>!pantryItems.includes(item)).map(item=>`<button type="button" data-quick-product="${item}">+ ${item}</button>`).join("");
  $("#quickProducts").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>addKitchenItems(button.dataset.quickProduct,"pantry")));
  if(!pantryItems.length&&!leftoverItems.length) $("#pantrySummary").innerHTML=`<h2>Сначала добавьте продукты</h2><p>Подойдут и общие слова: «рыба», «крупа», «овощи».</p>`;
  else if($("#pantryResultsSection").classList.contains("hidden")) $("#pantrySummary").innerHTML=`<div class="summary-number">${pantryItems.length+leftoverItems.length}</div><h2>добавлено</h2><p>Нажмите «Подобрать блюда», чтобы увидеть точные и адаптированные варианты.</p>`;
}
function analyzeRecipeForKitchen(recipe) {
  const stock=[...pantryItems.map(raw=>({raw,identity:productIdentity(raw),leftover:false})),...leftoverItems.map(raw=>({raw,identity:productIdentity(raw),leftover:true}))];
  const direct=[],replacements=[],missing=[]; const usedProteinSubstitutes=new Set(); let score=0;
  for(const [name] of recipe.ingredients){
    const target=productIdentity(name);
    if(target.group==="pantry") continue;
    const exact=stock.find(item=>isDirectProductMatch(item,target));
    if(exact){direct.push(name);score+=exact.leftover?7:4;continue;}
    const substitute=stock.find(item=>canSubstitute(item.identity,target,recipe));
    const isProtein=["fish","chicken","meat","legumes"].includes(target.group);
    if(substitute&&(!isProtein||!usedProteinSubstitutes.has(substitute.identity.group))){replacements.push({from:name,to:substitute.raw,leftover:substitute.leftover});if(isProtein)usedProteinSubstitutes.add(substitute.identity.group);score+=substitute.leftover?5:2.5;continue;}
    missing.push(name);score-=.75;
  }
  score+=Math.max(0,(25-recipe.time)/20);
  const relevant=direct.length+replacements.length+missing.length;
  return {recipe,direct,replacements,missing,score,coverage:relevant?(direct.length+replacements.length)/relevant:0,leftoverUsed:replacements.some(item=>item.leftover)||direct.some(name=>leftoverItems.some(item=>isDirectProductMatch({identity:productIdentity(item)},productIdentity(name))))};
}
function renderPantryResults() {
  const stockCount=pantryItems.length+leftoverItems.length;
  if(!stockCount){$("#pantryResultsSection").classList.add("hidden");renderPantry();return;}
  const matches=allRecipes().map(analyzeRecipeForKitchen).filter(item=>{
    const usable=item.direct.length+item.replacements.length>0&&item.replacements.length<=2&&item.missing.length<=3;
    const meaningful=!item.missing.length||item.coverage>=.4||(item.leftoverUsed&&item.coverage>=.25);
    return usable&&meaningful&&item.score>.5;
  }).sort((a,b)=>Number(b.leftoverUsed)-Number(a.leftoverUsed)||b.coverage-a.coverage||b.score-a.score||a.missing.length-b.missing.length);
  const ready=matches.filter(item=>!item.missing.length&&!item.replacements.length).length;
  const adapted=matches.filter(item=>item.replacements.length).length;
  $("#pantrySummary").innerHTML=`<div class="summary-number">${matches.length}</div><h2>вариантов</h2><dl><div><dt>${ready}</dt><dd>можно готовить сразу</dd></div><div><dt>${adapted}</dt><dd>с заменами</dd></div></dl>`;
  $("#pantryResultsMeta").textContent=`Сначала идут блюда, которые используют остатки и требуют меньше покупок.`;
  $("#pantryResults").innerHTML=matches.length?matches.map(item=>`<article class="pantry-recipe"><div class="pantry-recipe-head"><div><span>${mealNames[item.recipe.meal]} · ${item.recipe.time} мин</span><h3>${escapeHtml(item.recipe.title)}</h3></div>${item.leftoverUsed?`<b>Использует остатки</b>`:""}</div>${item.direct.length?`<div class="match-line"><strong>Уже есть</strong><span>${item.direct.slice(0,5).map(escapeHtml).join(" · ")}</span></div>`:""}${item.replacements.length?`<div class="match-line replacement-line"><strong>Заменить</strong><span>${item.replacements.map(change=>`${escapeHtml(change.from)} → ${escapeHtml(change.to)}`).join(" · ")}</span></div>`:""}${item.missing.length?`<div class="match-line missing-line"><strong>Докупить</strong><span>${item.missing.slice(0,4).map(escapeHtml).join(" · ")}</span></div>`:`<div class="match-line ready-line"><strong>Готово</strong><span>${item.replacements.length?"Можно приготовить с указанной заменой":"Дополнительные продукты не нужны"}</span></div>`}<div class="pantry-actions"><button class="favorite-button ${favorites.includes(item.recipe.id)?"active":""}" type="button" data-favorite="${item.recipe.id}">${favorites.includes(item.recipe.id)?"Любимое":"Сохранить"}</button><button class="small-button" type="button" data-view-recipe="${item.recipe.id}">Рецепт</button><button class="small-button" type="button" data-add="${item.recipe.id}">В список</button></div></article>`).join(""):`<div class="empty-state">Добавьте ещё один продукт или используйте более общее название.</div>`;
  $("#pantryResultsSection").classList.remove("hidden"); bindRecipeActions($("#pantryResults"));
}

const PLAN_MEALS=["breakfast","lunch","dinner","snack"];
function planPool(meal,exclude=[]) {
  let pool=allRecipes().filter(recipe=>recipe.meal===meal&&!exclude.includes(recipe.id));
  if(state.planMode==="quick") pool=pool.filter(recipe=>recipe.time<=20);
  if(state.planMode==="simple") pool=pool.filter(recipe=>recipe.ingredients.length<=5&&recipe.time<=40);
  if(!pool.length) pool=allRecipes().filter(recipe=>recipe.meal===meal&&!exclude.includes(recipe.id));
  if($("#usePantryInPlan")?.checked&&(pantryItems.length||leftoverItems.length)) pool=pool.map(recipe=>({recipe,score:analyzeRecipeForKitchen(recipe).score})).sort((a,b)=>b.score-a.score).map(item=>item.recipe);
  return pool;
}
function generateMealPlan() {
  const used=[]; const days=[];
  for(let day=0;day<state.planDays;day++){
    const date=new Date();date.setDate(date.getDate()+day);const meals={};
    for(const meal of PLAN_MEALS){
      if(state.planMode==="batch"&&day%2===1&&["lunch","dinner"].includes(meal)){meals[meal]=days[day-1].meals[meal];continue;}
      const pool=planPool(meal,used); const short=pool.slice(0,Math.min(18,pool.length)); const recipe=short[Math.floor(Math.random()*short.length)]||pool[0];
      if(recipe){meals[meal]=recipe.id;used.push(recipe.id);}
    }
    days.push({date:date.toISOString(),meals});
  }
  mealPlan=days;localStorage.setItem("meal-builder-plan-v1",JSON.stringify(mealPlan));renderMealPlan();
}
function renderMealPlan() {
  if(!mealPlan.length){$("#planBoard").innerHTML=`<div class="plan-empty"><strong>План появится здесь</strong><span>Выберите длительность и режим.</span></div>`;$("#planToolbar").classList.add("hidden");return;}
  const dateFormat=new Intl.DateTimeFormat("ru-RU",{weekday:"short",day:"numeric",month:"short"});
  $("#planBoard").innerHTML=mealPlan.map((day,dayIndex)=>`<section class="plan-day"><div class="plan-day-head"><span>День ${dayIndex+1}</span><strong>${dateFormat.format(new Date(day.date))}</strong></div>${PLAN_MEALS.map(meal=>{const recipe=recipeById(day.meals[meal]);return recipe?`<article class="plan-meal"><span>${mealNames[meal]}</span><button class="plan-title" type="button" data-view-recipe="${recipe.id}">${escapeHtml(recipe.title)}</button><small>${recipe.time} мин</small><button class="plan-swap" type="button" data-plan-swap="${dayIndex}:${meal}">Заменить</button></article>`:"";}).join("")}</section>`).join("");
  const recipes=mealPlan.flatMap(day=>Object.values(day.meals)).map(recipeById).filter(Boolean);const products=new Set(recipes.flatMap(recipe=>recipe.ingredients.map(item=>canonicalProduct(item[0]))).filter(key=>key!=="pantry"));
  $("#planHeading").textContent=`Меню на ${mealPlan.length} ${mealPlan.length===3?"дня":"дней"}`;$("#planMeta").textContent=`${recipes.length} блюд · ${products.size} групп продуктов`;$("#planToolbar").classList.remove("hidden");
  bindRecipeActions($("#planBoard"));
  $("#planBoard").querySelectorAll("[data-plan-swap]").forEach(button=>button.addEventListener("click",()=>{const [dayIndex,meal]=button.dataset.planSwap.split(":");const used=mealPlan.flatMap(day=>Object.values(day.meals));const pool=planPool(meal,used);if(pool.length){mealPlan[Number(dayIndex)].meals[meal]=pool[Math.floor(Math.random()*Math.min(12,pool.length))].id;localStorage.setItem("meal-builder-plan-v1",JSON.stringify(mealPlan));renderMealPlan();}}));
}
function addPlanToMenu() {
  for(const id of mealPlan.flatMap(day=>Object.values(day.meals))){const existing=saved.find(item=>item.id===id);if(existing)existing.portions+=1;else saved.push({id,portions:1});}
  persistSaved();openMenu();showToast("План добавлен в список");
}

function renderSituations() {
  $("#situationGrid").innerHTML=SITUATIONS.map(item=>`<button class="situation-card ${state.activeSituation===item.id?"active":""}" type="button" data-situation="${item.id}"><span>${item.icon}</span><strong>${item.title}</strong><small>${item.note}</small></button>`).join("");
  $("#situationGrid").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{state.activeSituation=button.dataset.situation;renderSituations();}));
  const current=SITUATIONS.find(item=>item.id===state.activeSituation)||SITUATIONS[0];const recipes=allRecipes().filter(current.test);
  $("#situationResultTitle").textContent=current.title;$("#situationResultMeta").textContent=`${recipes.length} ${recipes.length===1?"вариант":recipes.length<5?"варианта":"вариантов"}`;$("#situationResults").innerHTML=recipes.map(recipeCard).join("");bindRecipeActions($("#situationResults"));
  renderSmartResult();
}
function smartRandom() {
  const meal=$("#smartMeal").value;let pool=allRecipes().filter(recipe=>meal==="any"||recipe.meal===meal);let fresh=pool.filter(recipe=>!smartHistory.includes(recipe.id));if(!fresh.length){smartHistory=[];fresh=pool;}
  const recipe=fresh[Math.floor(Math.random()*fresh.length)];if(!recipe)return;
  smartHistory=[recipe.id,...smartHistory.filter(id=>id!==recipe.id)].slice(0,16);localStorage.setItem("meal-builder-smart-history-v1",JSON.stringify(smartHistory));renderSmartResult(recipe);
}
function renderSmartResult(recipe=null) {
  const current=recipe||(smartHistory.length?recipeById(smartHistory[0]):null);
  $("#smartResult").innerHTML=current?`<div><span>${mealNames[current.meal]} · ${current.time} мин</span><strong>${escapeHtml(current.title)}</strong><div><button type="button" data-view-recipe="${current.id}">Рецепт</button><button type="button" data-add="${current.id}">В список</button></div></div>`:`<span>Первый вариант появится после нажатия.</span>`;
  bindRecipeActions($("#smartResult"));
}

function formatAmount(value) { return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100).replace(".",","); }

function openRecipe(id) {
  const recipe = recipeById(id); if (!recipe) return;
  state.portions = 1;
  const paint = () => {
    const replacements=recipe.ingredients.map(([name])=>({name,alts:getIngredientAlternatives(name)})).filter(item=>item.alts.length).slice(0,5);
    els.dialogContent.innerHTML = `<div class="dialog-hero"><span class="dialog-food-icon">${mealIcons[recipe.meal]}</span><div class="recipe-meta"><span class="pill">${recipe.time} мин</span><span class="pill">${mealNames[recipe.meal]}</span></div><h2>${escapeHtml(recipe.title)}</h2><p>${escapeHtml(recipe.note || "Сохранённый рецепт.")}</p></div><div class="dialog-body"><section><h3>Продукты</h3><ul class="ingredient-list">${recipe.ingredients.map(([name,amount,unit]) => `<li>${escapeHtml(name)} — ${formatAmount(amount * state.portions)} ${escapeHtml(unit)}</li>`).join("")}</ul><div class="portion-row"><span>Порций</span><button class="portion-button" id="lessPortion" type="button">−</button><strong>${state.portions}</strong><button class="portion-button" id="morePortion" type="button">+</button></div><div class="dialog-actions"><button class="dialog-favorite ${favorites.includes(recipe.id)?"active":""}" id="dialogFavorite" type="button">${favorites.includes(recipe.id)?"В любимом":"В любимые"}</button><button class="dialog-add" id="dialogAdd" type="button">Добавить в список</button></div></section><section><h3>Как приготовить</h3><ol class="step-list">${recipe.steps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol>${replacements.length?`<div class="replacement-box"><h3>Чем можно заменить</h3>${replacements.map(item=>`<p><strong>${escapeHtml(item.name)}</strong><span>${item.alts.map(escapeHtml).join(" · ")}</span></p>`).join("")}</div>`:""}</section></div>`;
    $("#lessPortion").addEventListener("click", () => { state.portions = Math.max(1,state.portions-1); paint(); });
    $("#morePortion").addEventListener("click", () => { state.portions = Math.min(8,state.portions+1); paint(); });
    $("#dialogAdd").addEventListener("click", () => { addMeal(recipe.id,state.portions); els.dialog.close(); });
    $("#dialogFavorite").addEventListener("click", () => { toggleFavorite(recipe.id); paint(); });
  };
  paint(); els.dialog.showModal();
}

function bindRecipeActions(root = document) {
  root.querySelectorAll("[data-view-recipe]").forEach(button => button.addEventListener("click", () => openRecipe(button.dataset.viewRecipe)));
  root.querySelectorAll("[data-add]").forEach(button => button.addEventListener("click", () => addMeal(button.dataset.add,1)));
  root.querySelectorAll("[data-favorite]").forEach(button => button.addEventListener("click", () => toggleFavorite(button.dataset.favorite)));
}

function getIngredientAlternatives(name) {
  const normalized=normalizeProduct(name);
  if(/овся|хлоп/.test(normalized)) return ["пшённые хлопья","манная крупа"];
  if(/молоко|вода/.test(normalized)) return ["вода","растительное молоко"];
  if(/греч/.test(normalized)) return ["рис","булгур","макароны"];
  const key=canonicalProduct(name);
  return (DISPLAY_ALTERNATIVES[key]||(SUBSTITUTION_MATRIX[key]||[]).map(productLabel)).slice(0,3);
}
function toggleFavorite(id) {
  favorites=favorites.includes(id)?favorites.filter(item=>item!==id):[...favorites,id];
  localStorage.setItem("meal-builder-favorites-v1",JSON.stringify(favorites));
  $$(`[data-favorite="${id}"]`).forEach(button=>{button.classList.toggle("active",favorites.includes(id));button.textContent=favorites.includes(id)?"Любимое":"Сохранить";});
  renderMine();
  if($("[data-view='library']").classList.contains("active")) renderLibrary();
  showToast(favorites.includes(id)?"Добавлено в любимые":"Убрано из любимых");
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
    els.savedMeals.innerHTML = `<div class="empty-state">Добавьте сюда блюда из подбора или библиотеки.</div>`;
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
  if (safeRoute === "library") renderLibrary();
  if (safeRoute === "mine") renderMine();
  if (safeRoute === "pairings") renderPairings();
  if (safeRoute === "order") renderOrderCategories();
  if (safeRoute === "pantry") renderPantry();
  if (safeRoute === "planner") renderMealPlan();
  if (safeRoute === "situations") renderSituations();
}

function renderLibrary() {
  const query=$("#recipeSearch").value.trim().toLowerCase(); const meal=$("#libraryMeal").value;
  const list=allRecipes().filter(recipe => (meal==="any" || recipe.meal===meal) && (!state.libraryFavoriteOnly||favorites.includes(recipe.id)) && (!query || `${recipe.title} ${recipe.note} ${recipe.ingredients.map(i=>i[0]).join(" ")}`.toLowerCase().includes(query)));
  $("#recipeTotal").textContent=allRecipes().length;
  $("#topbarCount").textContent=`${allRecipes().length} рецептов`;
  $("#favoriteFilter").classList.toggle("active",state.libraryFavoriteOnly);
  $("#libraryList").innerHTML=list.length ? list.map(recipe => `<article class="library-row"><span class="library-icon">${mealIcons[recipe.meal]}</span><div><strong>${escapeHtml(recipe.title)}</strong><small>${mealNames[recipe.meal]} · ${recipe.time} мин</small></div><div class="library-actions"><button class="favorite-button ${favorites.includes(recipe.id)?"active":""}" type="button" data-favorite="${recipe.id}">${favorites.includes(recipe.id)?"Любимое":"Сохранить"}</button><button class="small-button" type="button" data-view-recipe="${recipe.id}">Открыть</button><button class="small-button" type="button" data-add="${recipe.id}">В список</button></div></article>`).join("") : `<div class="empty-state">По этому запросу ничего не найдено.</div>`;
  bindRecipeActions($("#libraryList"));
}

function parseIngredient(line) {
  const parts=line.split(/\s+[—-]\s+/); const name=(parts[0]||"Продукт").trim(); const tail=(parts[1]||"1 шт.").trim(); const match=tail.match(/^([\d.,]+)\s*(.*)$/); return [name,match ? Number(match[1].replace(",",".")) : 1,match ? (match[2]||"шт.") : tail];
}

function renderMine() {
  favorites=favorites.filter(id=>recipeById(id));
  $("#customCount").textContent=customRecipes.length; $("#collectionCount").textContent=collections.length; $("#favoriteCount").textContent=favorites.length;
  $("#customRecipeList").innerHTML=customRecipes.length ? customRecipes.map(recipe => `<article class="compact-row"><div><strong>${escapeHtml(recipe.title)}</strong><small>${mealNames[recipe.meal]} · ${recipe.time} мин</small></div><div class="row-actions"><button type="button" data-view-recipe="${recipe.id}">Открыть</button><button type="button" data-add="${recipe.id}">В список</button><button class="remove" type="button" data-delete-custom="${recipe.id}">Удалить</button></div></article>`).join("") : `<div class="empty-state">Здесь появятся ваши рецепты.</div>`;
  bindRecipeActions($("#customRecipeList"));
  $("#customRecipeList").querySelectorAll("[data-delete-custom]").forEach(button => button.addEventListener("click", () => { customRecipes=customRecipes.filter(item=>item.id!==button.dataset.deleteCustom); saved=saved.filter(item=>item.id!==button.dataset.deleteCustom); persistCustom(); persistSaved(); renderMine(); }));
  $("#favoriteList").innerHTML=favorites.length?favorites.map(id=>recipeById(id)).filter(Boolean).map(recipe=>`<article class="compact-row"><div><strong>${escapeHtml(recipe.title)}</strong><small>${mealNames[recipe.meal]} · ${recipe.time} мин</small></div><div class="row-actions"><button type="button" data-view-recipe="${recipe.id}">Открыть</button><button type="button" data-add="${recipe.id}">В список</button><button class="remove" type="button" data-favorite="${recipe.id}">Убрать</button></div></article>`).join(""):`<div class="empty-state">Отмечайте блюда сердечком, чтобы собрать их здесь.</div>`;
  bindRecipeActions($("#favoriteList"));
  $("#collectionList").innerHTML=collections.length ? collections.map((collection,index) => `<article class="compact-row"><div><strong>${escapeHtml(collection.name)}</strong><small>${collection.items.length} ${collection.items.length===1?"блюдо":"блюда"}</small></div><div class="row-actions"><button type="button" data-load-collection="${index}">Загрузить</button><button class="remove" type="button" data-delete-collection="${index}">Удалить</button></div></article>`).join("") : `<div class="empty-state">Сохранённые подборки появятся здесь.</div>`;
  $("#collectionList").querySelectorAll("[data-load-collection]").forEach(button=>button.addEventListener("click",()=>{ saved=JSON.parse(JSON.stringify(collections[Number(button.dataset.loadCollection)].items)).filter(item=>recipeById(item.id)); persistSaved(); showToast("Подборка загружена"); }));
  $("#collectionList").querySelectorAll("[data-delete-collection]").forEach(button=>button.addEventListener("click",()=>{ collections.splice(Number(button.dataset.deleteCollection),1); persistCollections(); renderMine(); }));
}

function persistCustom(){ localStorage.setItem("meal-builder-custom-v1",JSON.stringify(customRecipes)); }
function persistCollections(){ localStorage.setItem("meal-builder-collections-v1",JSON.stringify(collections)); }

function renderPairings() {
  $("#drinkSelector").innerHTML=Object.entries(PAIRINGS).map(([id,item])=>`<button class="drink-button ${state.drink===id?"active":""}" type="button" data-drink="${id}"><span>${item.icon}</span>${item.name}</button>`).join("");
  $("#drinkSelector").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{state.drink=button.dataset.drink; renderPairings();}));
  $("#pairingFormat").querySelectorAll("button").forEach(button => button.classList.toggle("active",button.dataset.pairingFormat===state.pairingFormat));
  const efforts = state.pairingFormat === "snack" ? [["any","Любая"],["simple","Без готовки"],["quick","До 20 минут"]] : [["any","Любая"],["quick","До 20 минут"],["cook","Можно приготовить"]];
  $("#pairingEffort").innerHTML=efforts.map(([id,label])=>`<button class="choice ${state.pairingEffort===id?"active":""}" type="button" data-pairing-effort="${id}">${label}</button>`).join("");
  $("#pairingEffort").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{state.pairingEffort=button.dataset.pairingEffort;renderPairings();}));
  const current=PAIRINGS[state.drink];
  $("#pairingIntro").innerHTML=`<span>${current.icon}</span><div><small>Сейчас выбрано</small><h2>${current.name}</h2></div>`;
  const cards=current.pairs.map((pair,index)=>{
    const effort=state.pairingFormat==="snack"?(index===2?"quick":"simple"):(index===2?"quick":"cook");
    const title=state.pairingFormat==="snack"?pair[0]:pair[1];
    const method=state.pairingFormat==="snack"?(effort==="simple"?"Соберите продукты на небольшой тарелке и подайте охлаждёнными.":"Подготовьте и соберите закуску за 15–20 минут."):(effort==="quick"?"Приготовьте основное на сковороде и подайте сразу.":"Запеките или потушите основное блюдо, затем добавьте гарнир.");
    return {title,effort,items:pair[2],method};
  }).filter(item=>state.pairingEffort==="any"||item.effort===state.pairingEffort);
  $("#pairingResults").innerHTML=cards.length?cards.map((item,index)=>`<article class="pairing-card"><span class="pair-number">0${index+1}</span><span class="pair-label">${item.effort==="simple"?"без готовки":item.effort==="quick"?"до 20 минут":"ужин"}</span><h3>${escapeHtml(item.title)}</h3><ul>${item.items.map(product=>`<li>${escapeHtml(product)}</li>`).join("")}</ul><p class="pair-method">${item.method}</p></article>`).join(""):`<div class="empty-state">Для этого выбора попробуйте другую сложность.</div>`;
}

function renderOrderCategories() {
  $("#orderCategories").innerHTML=Object.entries(ORDER_CATEGORY_INFO).map(([id,[label,icon]])=>{
    const count=ORDER_OPTIONS.filter(item=>item.category===id).length;
    const word=count===1?"вариант":count<5?"варианта":"вариантов";
    return `<button class="order-category ${state.orderCategories.includes(id)?"active":""}" type="button" data-order-category="${id}"><span>${icon}</span><strong>${label}</strong><small>${count} ${word}</small></button>`;
  }).join("");
  $("#orderCategories").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{
    const id=button.dataset.orderCategory;
    state.orderCategories=state.orderCategories.includes(id)?state.orderCategories.filter(item=>item!==id):[...state.orderCategories,id];
    renderOrderCategories();
  }));
}

function randomOrder() {
  let pool=ORDER_OPTIONS.filter(option=>option.moods.includes(state.orderMood));
  if(state.orderCategories.length) pool=pool.filter(option=>state.orderCategories.includes(option.category));
  if(!pool.length) pool=ORDER_OPTIONS.filter(option=>!state.orderCategories.length||state.orderCategories.includes(option.category));
  const choice=pool[Math.floor(Math.random()*pool.length)]; const [category,icon]=ORDER_CATEGORY_INFO[choice.category];
  $("#orderResult").innerHTML=`<div class="order-result-inner"><span class="order-result-icon">${icon}</span><small>${category}</small><h2>${choice.title}</h2><p class="order-detail">${choice.detail}</p><button class="secondary-button reroll" id="rerollOrder" type="button">Ещё вариант</button></div>`;
  $("#rerollOrder").addEventListener("click",randomOrder);
}

$$("[data-meal]").forEach(button=>button.addEventListener("click",()=>{ state.meal=button.dataset.meal; state.mood="any"; state.base="any"; $$("[data-meal]").forEach(item=>item.classList.toggle("active",item===button)); renderQuestions(); els.results.classList.add("hidden"); }));
[[els.veggieOptions,"veggie"],[els.timeOptions,"time"]].forEach(([container,key])=>container.querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{ state[key]=key==="time"?Number(button.dataset.value):button.dataset.value; container.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button)); updateMatchSummary(); })));
$$("[data-route]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.route)));
$$("[data-route-link]").forEach(link=>link.addEventListener("click",event=>{event.preventDefault();navigate(link.dataset.routeLink);}));
$("#suggestButton").addEventListener("click",()=>suggestRecipes());
$("#quickShuffle").addEventListener("click",renderQuickList);
$("#simpleRandom").addEventListener("click",()=>{ const bases=Object.keys(SIMPLE_BASES); state.simpleBase=bases[Math.floor(Math.random()*bases.length)]; const addons=Object.keys(SIMPLE_BASES[state.simpleBase].addons); state.simpleAddon=addons[Math.floor(Math.random()*addons.length)]; renderSimpleComposer(); });
$("#resetButton").addEventListener("click",()=>{Object.assign(state,{meal:"breakfast",mood:"any",base:"any",veggie:"any",time:20}); $$("[data-meal]").forEach(item=>item.classList.toggle("active",item.dataset.meal==="breakfast")); els.veggieOptions.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item.dataset.value==="any")); els.timeOptions.querySelectorAll("button").forEach(item=>item.classList.toggle("active",item.dataset.value==="20")); els.results.classList.add("hidden"); renderQuestions();});
$("#menuButton").addEventListener("click",openMenu); $("#closeMenuButton").addEventListener("click",closePanels); els.overlay.addEventListener("click",closePanels); $("#mobileMenuButton").addEventListener("click",()=>{els.sidebar.classList.add("open");els.overlay.classList.remove("hidden");document.body.style.overflow="hidden";});
$("#closeDialogButton").addEventListener("click",()=>els.dialog.close()); $("#clearMenuButton").addEventListener("click",()=>{if(saved.length){saved=[];persistSaved();showToast("Список очищен");}});
$("#copyListButton").addEventListener("click",async()=>{if(!saved.length)return showToast("Список пока пуст");const text=aggregateIngredients().map(item=>`• ${item.name} — ${item.amounts.join(" + ")}`).join("\n");try{await navigator.clipboard.writeText(text);showToast("Список скопирован");}catch{showToast("Не получилось скопировать");}});
$("#recipeSearch").addEventListener("input",renderLibrary); $("#libraryMeal").addEventListener("change",renderLibrary);
$("#favoriteFilter").addEventListener("click",()=>{state.libraryFavoriteOnly=!state.libraryFavoriteOnly;renderLibrary();});
$("#pantryForm").addEventListener("submit",event=>{event.preventDefault();addKitchenItems($("#pantryInput").value,"pantry");$("#pantryInput").value="";});
$("#leftoverForm").addEventListener("submit",event=>{event.preventDefault();addKitchenItems($("#leftoverInput").value,"leftover");$("#leftoverInput").value="";});
$("#findFromPantry").addEventListener("click",renderPantryResults);
$("#clearPantry").addEventListener("click",()=>{pantryItems=[];leftoverItems=[];persistKitchen();renderPantry();$("#pantryResultsSection").classList.add("hidden");});
$("#planDays").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{state.planDays=Number(button.dataset.planDays);$("#planDays").querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button));}));
$("#planMode").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{state.planMode=button.dataset.planMode;$("#planMode").querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button));}));
$("#generatePlan").addEventListener("click",generateMealPlan);$("#addPlanToList").addEventListener("click",addPlanToMenu);$("#clearPlan").addEventListener("click",()=>{mealPlan=[];localStorage.removeItem("meal-builder-plan-v1");renderMealPlan();});
$("#smartRandomButton").addEventListener("click",smartRandom);
$("#customRecipeForm").addEventListener("submit",event=>{event.preventDefault();const data=new FormData(event.currentTarget);const recipe={id:`custom-${Date.now()}`,title:data.get("title").trim(),meal:data.get("meal"),mood:"any",base:"any",veggie:"any",time:Number(data.get("time")),note:data.get("note").trim()||"Ваш сохранённый рецепт.",ingredients:data.get("ingredients").split("\n").map(s=>s.trim()).filter(Boolean).map(parseIngredient),steps:data.get("steps").split("\n").map(s=>s.trim()).filter(Boolean)};customRecipes.unshift(recipe);persistCustom();event.currentTarget.reset();event.currentTarget.elements.time.value=20;renderMine();renderLibrary();showToast("Рецепт сохранён");});
$("#collectionForm").addEventListener("submit",event=>{event.preventDefault();if(!saved.length)return showToast("Текущий список пуст");const data=new FormData(event.currentTarget);collections.unshift({name:data.get("name").trim(),items:JSON.parse(JSON.stringify(saved)),createdAt:new Date().toISOString()});persistCollections();event.currentTarget.reset();renderMine();showToast("Подборка сохранена");});
$("#exportButton").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({customRecipes,collections,favorites,pantryItems,leftoverItems,mealPlan},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="my-menu-data.json";link.click();URL.revokeObjectURL(url);});
$("#importInput").addEventListener("change",async event=>{const file=event.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.customRecipes)||!Array.isArray(data.collections))throw new Error();customRecipes=data.customRecipes;collections=data.collections;favorites=Array.isArray(data.favorites)?data.favorites:[];pantryItems=Array.isArray(data.pantryItems)?data.pantryItems:[];leftoverItems=Array.isArray(data.leftoverItems)?data.leftoverItems:[];mealPlan=Array.isArray(data.mealPlan)?data.mealPlan:[];persistCustom();persistCollections();persistKitchen();localStorage.setItem("meal-builder-favorites-v1",JSON.stringify(favorites));localStorage.setItem("meal-builder-plan-v1",JSON.stringify(mealPlan));renderMine();renderLibrary();renderPantry();renderMealPlan();showToast("Данные загружены");}catch{showToast("Файл не подходит");}event.target.value="";});
$("#pairingFormat").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{state.pairingFormat=button.dataset.pairingFormat;state.pairingEffort="any";renderPairings();}));
$("#orderMood").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{state.orderMood=button.dataset.orderMood;$("#orderMood").querySelectorAll("button").forEach(item=>item.classList.toggle("active",item===button));}));
$("#randomOrderButton").addEventListener("click",randomOrder);
document.addEventListener("keydown",event=>{if(event.key==="Escape")closePanels();});

renderQuestions(); renderSimpleComposer(); renderMenu(); renderLibrary(); renderMine(); renderPairings(); renderOrderCategories(); renderPantry(); renderMealPlan(); renderSituations();

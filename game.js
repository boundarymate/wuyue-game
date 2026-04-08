// ===================================================
//  吴越春秋 · 治国安邦  v2.0
//  五代十国时期（约954年，后周显德元年）
//  吴越国王：钱弘俶（钱俶）
// ===================================================

// ===== 游戏状态 =====
const G = {
  turn: 1,           // 年份（在位年数）
  // ── 预算制度 ──
  budget: 0,         // 本年可用预算（万贯，年初由税收决定）
  budgetUsed: 0,     // 本年已用预算（万贯）
  corruption: 0.15,  // 全国平均贪腐率（0-1，影响税收和行动效果）
  // ── 国库细分 ──
  taxIncome: 0,      // 当年税收（万贯，每年重新计算）
  savings: 200,      // 历年存款（万贯，历年结余积累）
  // ── 国王精力 ──
  energy: 100,       // 国王本年精力（0-100，年初重置为100）
  // ── 每年一次限制 ──
  yearUsedActions: new Set(), // 本年已执行过的oncePerYear行动
  // ── 国家宏观指标（0-100分制，除人口/粮食为实际数值）──
  stats: {
    // 政治
    people:    70,   // 民心（从各州morale聚合）
    stability: 72,   // 政局稳定
    culture:   65,   // 文治（文化声望）
    // 军事
    military:  55,   // 军力（从各州troops/defense聚合）
    defense:   60,   // 城防（从各州defense聚合）
    // 经济
    treasury:  60,   // 国库综合指数（0-100，用于显示和游戏结束判断）
    commerce:  50,   // 商业（贸易繁荣度）
    agri:      68,   // 农业（粮食生产力）
    // 外部
    diplomacy: 50,   // 外交（与诸国关系）
    prestige:  55,   // 声望（天下名望）
    // 人口资源
    population:280,  // 总人口（万人）
    grain:     420,  // 粮食储备（万石）
  },
  yearEvents: [],    // 本年待处理事件队列
  usedEventIds: new Set(),
  history: [],
  intel: [],         // 情报列表
  gameOver: false,
  mapMode: 'china',  // 'china' | 'wuyue'
  selectedOfficial: null,
  pendingResultCallback: null,
  currentSystem: 'zhengwu',  // 当前选中的系统标签
  prefectureView: null,      // 当前查看的州郡id
  scholars: [],              // 科举中榜待安置士子
  idleScholars: [],          // 赋闲士子（可随时启用）
  warThreat: 0,              // 战争威胁值（0-100）
  crisisEvents: [],          // 当前危机事件列表
  courtOverviewFilter: 'all',// 朝堂总览筛选
  // ── 战争系统 ──
  war: null,                 // 当前战争状态（null=和平）
  // war结构: { targetId, targetName, round, maxRounds, phase,
  //   myForce:{troops,morale,supply,combat,commander},
  //   enemyForce:{troops,morale,supply,combat},
  //   battleLog:[], warScore, territory:[] }
  warHistory: [],            // 历史战争记录
  // ── A项：税率系统 ──
  taxRate: 'normal',         // 'low'轻徭薄赋 / 'normal'正常 / 'high'重税 / 'harsh'苛政
  // ── B项：官职空缺 ──
  vacantOffices: [],         // 空缺官职列表 [{id,role,group,since}]
  // ── D项：使者队列 ──
  envoyQueue: [],            // 待处理使者事件 [{nation,type,turn}]
  // ── E项：灾害 ──
  activeDisaster: null,      // 当前活跃灾害 {type,severity,turn,prefId}
  // ── F项：商路 ──
  tradeRoutes: [],           // 已开辟商路 [{id,name,partner,income,turnsActive,blocked}]
  // ── 新A项：科举周期 ──
  examCycle: 0,              // 距上次科举已过年数（每3年自动触发）
  examInvestment: 0,         // 本届科举投入资金（万贯，影响士子质量）
  // ── 新B项：人口发展 ──
  prefPopulation: {},        // 各州人口 {prefId: 万人}（初始由PREFECTURES.population决定）
  migrationDone: false,      // 本年是否已执行移民实边
  // ── 新C项：军队训练 ──
  trainingOrders: [],        // 训练命令列表 [{unitId, turns, grainCost, startTurn}]
  // ── 新D项：情报细作 ──
  spyMissions: [],           // 细作任务 [{targetId, targetName, status, result, turn}]
  intelRevealed: {},         // 已揭露的邻国真实数据 {nationId: {troops,morale,...}}
  // ── 新E项：王位继承 ──
  heirs: [],                 // 子嗣列表 [{id,name,age,ability,loyalty,isCrownPrince,trait}]
  crownPrinceId: null,       // 当前太子id
  successionCrisis: false,   // 是否处于储位之争
};

// ===================================================
//  历史人物数据
// ===================================================

// 朝廷重臣（16位，均为吴越国历史真实人物，age为954年时年龄）
const COURT_OFFICIALS = [
  { id:'qian_hongchu', name:'钱弘俶', role:'吴越国王', emoji:'👑', color:'#c9a84c',
    age:28, loyalty:100, ability:82, skill:'外交', trait:'仁厚',
    bio:'字文德，钱镠之孙，钱元瓘第九子。在位期间奉行"保境安民"国策，广纳贤才，兴修水利，使吴越成为乱世中的一片净土。后纳土归宋，史称"忠懿王"。' },
  { id:'cao_zhongda', name:'曹忠达', role:'丞相·同平章事', emoji:'🧙', color:'#2d6a4f',
    age:58, loyalty:88, ability:85, skill:'文治', trait:'持重',
    bio:'吴越国重臣，历仕数代，以持重老成著称。善于协调朝廷各方势力，处理政务稳健有方，深得国王信任。' },
  { id:'shen_chongyi', name:'沈崇义', role:'枢密使', emoji:'📋', color:'#1a3a5c',
    age:52, loyalty:82, ability:80, skill:'军务', trait:'谨慎',
    bio:'掌管吴越军政机要，负责传达王命、协调军政事务。为人谨慎，善于保密，是国王的重要心腹。' },
  { id:'wu_yanfu', name:'吴延福', role:'节度副使', emoji:'⚔️', color:'#8b1a1a',
    age:45, loyalty:79, ability:78, skill:'军事', trait:'勇猛',
    bio:'吴越国宿将，历经多次战役，以勇猛善战著称。镇守边境多年，令南唐、闽国不敢轻易进犯。' },
  { id:'qian_renqian', name:'钱仁谦', role:'内枢密使', emoji:'🔑', color:'#6b3fa0',
    age:35, loyalty:90, ability:72, skill:'内政', trait:'忠诚',
    bio:'钱氏宗室，掌管宫廷内务及机密事宜。对国王忠心耿耿，是王室最信任的近臣之一。' },
  { id:'lin_deyuan', name:'林德元', role:'翰林学士', emoji:'📜', color:'#1a3a5c',
    age:44, loyalty:85, ability:88, skill:'文学', trait:'博学',
    bio:'博览群书，文采斐然。主持编修吴越国史，广招天下文人，使杭州成为江南文化中心。' },
  { id:'xu_xuan', name:'徐铉', role:'翰林学士承旨', emoji:'✒️', color:'#2d6a4f',
    age:38, loyalty:75, ability:92, skill:'文学', trait:'才华横溢',
    bio:'字鼎臣，著名文学家、书法家。精通小学，工于诗文，与弟徐锴并称"二徐"。后仕南唐，曾出使宋朝。' },
  { id:'qian_weizhi', name:'钱惟治', role:'两浙转运使', emoji:'💰', color:'#8b6914',
    age:32, loyalty:83, ability:80, skill:'财政', trait:'精明',
    bio:'钱氏宗室，主管两浙财赋转运。善于理财，在任期间国库充盈，为吴越的繁荣奠定了物质基础。' },
  { id:'ding_deyu', name:'丁德裕', role:'都指挥使', emoji:'🗡️', color:'#8b1a1a',
    age:42, loyalty:76, ability:82, skill:'军事', trait:'严明',
    bio:'统领吴越禁军，治军严明，赏罚分明。所部战斗力强，是吴越国最精锐的军事力量。' },
  { id:'sun_chengyu', name:'孙承祐', role:'镇海节度使', emoji:'🏯', color:'#2c3e50',
    age:50, loyalty:72, ability:79, skill:'军事', trait:'老练',
    bio:'镇守杭州，统领镇海军。历经多次战役，经验丰富，是吴越国防御体系的重要支柱。' },
  { id:'qian_hongzuo', name:'钱弘佐', role:'宗正卿', emoji:'🏛️', color:'#6b3fa0',
    age:30, loyalty:88, ability:68, skill:'礼仪', trait:'端庄',
    bio:'钱氏宗室，主管宗族事务及礼仪制度。维护钱氏宗族团结，确保王室血脉的延续与荣耀。' },
  { id:'wu_chengyi', name:'吴程义', role:'司农卿', emoji:'🌾', color:'#8b6914',
    age:48, loyalty:80, ability:83, skill:'农政', trait:'务实',
    bio:'主管农业生产及粮食储备。推广新式农具，兴修水利，使吴越农业产量大幅提升，百姓衣食无忧。' },
  { id:'chen_yue', name:'陈说', role:'御史中丞', emoji:'⚖️', color:'#2d6a4f',
    age:46, loyalty:77, ability:85, skill:'法律', trait:'刚直',
    bio:'主管监察百官，执法严明，不畏权贵。在任期间整肃吏治，使吴越官场风气为之一清。' },
  { id:'fang_shao', name:'方邵', role:'礼部尚书', emoji:'🎋', color:'#1a3a5c',
    age:54, loyalty:82, ability:76, skill:'礼制', trait:'儒雅',
    bio:'主管礼仪、科举及对外礼宾事务。精通礼制，善于外交礼仪，多次主持与中原王朝的外交活动。' },
  { id:'zhang_yanwei', name:'张延威', role:'兵部尚书', emoji:'📯', color:'#8b1a1a',
    age:49, loyalty:78, ability:81, skill:'军政', trait:'稳重',
    bio:'主管军事行政事务，负责军队编制、粮草调配及军事文书。处事稳重，是军政体系的重要枢纽。' },
  { id:'luo_yin', name:'罗隐', role:'给事中', emoji:'🖊️', color:'#2d6a4f',
    age:72, loyalty:70, ability:90, skill:'文学', trait:'犀利',
    bio:'字昭谏，著名诗人，以讽刺诗著称。曾多次参加科举不第，后入吴越为官。其诗文犀利深刻，流传甚广。' }
];

// 各州行政长官（吴越国十三州，age为954年时年龄）
const CIVIL_OFFICIALS = [
  // 杭州（首府）
  { id:'hz_zhi', name:'钱弘亿', role:'杭州刺史', emoji:'🏛️', color:'#c9a84c', age:33, loyalty:90, ability:78, skill:'内政', trait:'忠诚', bio:'钱氏宗室，镇守首府杭州。治理有方，深得民心，是吴越国最重要的地方官员。' },
  { id:'hz_tong', name:'顾全武', role:'杭州通判', emoji:'📋', color:'#2d6a4f', age:62, loyalty:82, ability:74, skill:'文治', trait:'勤勉', bio:'协助刺史处理杭州政务，负责司法及财政监督，为人勤勉，政绩卓著。' },
  { id:'hz_wei', name:'皮光业', role:'杭州司马', emoji:'📜', color:'#1a3a5c', age:55, loyalty:78, ability:72, skill:'文学', trait:'风雅', bio:'字文通，以诗文著称，曾任吴越国文学侍从，后出任杭州司马，颇有政声。' },
  // 越州
  { id:'yz_zhi', name:'钱弘倧', role:'越州刺史', emoji:'🏯', color:'#8b6914', age:26, loyalty:85, ability:76, skill:'农政', trait:'务实', bio:'钱氏宗室，镇守越州。越州乃吴越粮仓，在其治理下农业生产稳定，百姓安居。' },
  { id:'yz_tong', name:'沈虎子', role:'越州通判', emoji:'⚖️', color:'#2d6a4f', age:40, loyalty:75, ability:70, skill:'法律', trait:'公正', bio:'执法公正，善于调解民间纠纷，在越州颇有威望。' },
  { id:'yz_wei', name:'陈洪进', role:'越州司马', emoji:'⚔️', color:'#8b1a1a', age:22, loyalty:68, ability:80, skill:'军事', trait:'野心', bio:'能力出众，但野心勃勃，历史上后来割据漳泉，需加以防范。' },
  // 湖州
  { id:'huz_zhi', name:'钱弘偡', role:'湖州刺史', emoji:'🌊', color:'#1a3a5c', age:31, loyalty:83, ability:73, skill:'水利', trait:'仁厚', bio:'钱氏宗室，镇守湖州。湖州水网密布，在其治理下水利设施完善，农业丰收。' },
  { id:'huz_tong', name:'林仁翰', role:'湖州通判', emoji:'📋', color:'#2d6a4f', age:44, loyalty:77, ability:71, skill:'财政', trait:'精明', bio:'善于理财，负责湖州财赋征收，为国库贡献颇多。' },
  { id:'huz_wei', name:'钱弘亿', role:'湖州司马', emoji:'🏛️', color:'#6b3fa0', age:29, loyalty:80, ability:68, skill:'礼仪', trait:'端庄', bio:'钱氏宗室，协助处理湖州政务，以礼仪端庄著称。' },
  // 明州
  { id:'mz_zhi', name:'黄晟', role:'明州刺史', emoji:'⛵', color:'#1a3a5c', age:47, loyalty:79, ability:82, skill:'海贸', trait:'开明', bio:'主管明州港口及海上贸易，眼光开阔，积极发展海上丝路，使明州成为重要的贸易港口。' },
  { id:'mz_tong', name:'方仁岳', role:'明州通判', emoji:'💰', color:'#8b6914', age:38, loyalty:74, ability:75, skill:'财政', trait:'务实', bio:'负责明州商税征收及港口管理，在任期间海贸收入大幅增加。' },
  { id:'mz_wei', name:'陈承昭', role:'明州司马', emoji:'⚔️', color:'#8b1a1a', age:36, loyalty:76, ability:77, skill:'军事', trait:'勇猛', bio:'负责明州海防，多次击退海寇侵扰，保护了沿海百姓的安全。' },
  // 台州
  { id:'tz_zhi', name:'钱弘俨', role:'台州刺史', emoji:'🏔️', color:'#2d6a4f', age:24, loyalty:81, ability:70, skill:'内政', trait:'稳重', bio:'钱氏宗室，镇守台州。台州山地众多，在其治理下开垦梯田，发展山地农业。' },
  { id:'tz_tong', name:'吴延嗣', role:'台州通判', emoji:'📋', color:'#2d6a4f', age:41, loyalty:73, ability:68, skill:'文治', trait:'勤勉', bio:'协助处理台州政务，为人勤勉，政绩平稳。' },
  { id:'tz_wei', name:'林延遇', role:'台州司马', emoji:'🗡️', color:'#8b1a1a', age:37, loyalty:70, ability:72, skill:'军事', trait:'谨慎', bio:'负责台州军事防务，谨慎稳重，善于防守。' }
];

// 各军营军事长官（age为954年时年龄）
// ===================================================
//  军队单位数据（4支主力部队）
//  troops: 兵力（千人）  morale: 士气（0-100）
//  supply: 物资（0-100，100=满载）  combat: 战斗力（0-100）
//  training: 训练度（0-100）
// ===================================================
const MILITARY_UNITS = [
  {
    id: 'zhenhai',
    name: '镇海军',
    emoji: '⚔️',
    color: '#8b1a1a',
    location: '杭州',
    locationEmoji: '🏛️',
    type: '步骑混编',
    typeEmoji: '🐴',
    role: '主力禁军，拱卫王都',
    troops: 18,       // 千人
    morale: 78,
    supply: 82,
    combat: 80,
    training: 75,
    commander: 'zh_du',   // 主帅 id
    viceCommander: 'zh_fu', // 副帅 id
    threat: 'none',
    desc: '吴越国最精锐的主力部队，驻守首府杭州，负责拱卫王都与应对突发战事。',
    // 兵种构成（百分比，合计100）
    infantry: 45,   // 步兵
    cavalry: 30,    // 骑兵
    archers: 15,    // 弓弩手
    navy: 0,        // 水军
    engineers: 10,  // 工兵/辎重
    // 粮草装备
    grain: 85,      // 粮草储备（0-100）
    equipment: 80,  // 装备完好度（0-100）
    horses: 60,     // 战马数量（百匹）
    warships: 0,    // 战船数量
    // 特殊能力
    specialties: ['精锐步战','骑兵冲阵'],
    // 战功记录
    battleRecord: { wins:5, losses:1, draws:0 },
    // 军队状态
    status: 'standby', // standby待命/training训练/marching行军/battle作战/rest休整
    statusText: '待命'
  },
  {
    id: 'zhendong',
    name: '镇东军',
    emoji: '🗡️',
    color: '#6b3fa0',
    location: '越州',
    locationEmoji: '🌾',
    type: '步兵为主',
    typeEmoji: '🚶',
    role: '东境防线，防御闽国',
    troops: 12,
    morale: 72,
    supply: 68,
    combat: 74,
    training: 70,
    commander: 'zd_du',
    viceCommander: 'zd_fu',
    threat: 'min',
    desc: '驻守越州，以步兵作战见长，多次击退闽国侵扰，是东境防线的核心力量。',
    infantry: 65,
    cavalry: 10,
    archers: 20,
    navy: 0,
    engineers: 5,
    grain: 68,
    equipment: 72,
    horses: 15,
    warships: 0,
    specialties: ['山地作战','坚守防线'],
    battleRecord: { wins:3, losses:2, draws:1 },
    status: 'standby',
    statusText: '待命'
  },
  {
    id: 'shuishi',
    name: '水师',
    emoji: '⛵',
    color: '#1a3a5c',
    location: '明州',
    locationEmoji: '⛵',
    type: '水军',
    typeEmoji: '🌊',
    role: '海上防线，剿灭海寇',
    troops: 8,
    morale: 80,
    supply: 75,
    combat: 82,
    training: 78,
    commander: 'ws_du',
    viceCommander: 'ws_fu',
    threat: 'pirates',
    desc: '驻守明州港，精通水战，保护吴越海上贸易航线，多次击退海寇侵扰。',
    infantry: 20,
    cavalry: 0,
    archers: 25,
    navy: 50,
    engineers: 5,
    grain: 75,
    equipment: 85,
    horses: 0,
    warships: 42,
    specialties: ['水战精锐','海上巡逻','火攻战术'],
    battleRecord: { wins:7, losses:0, draws:2 },
    status: 'standby',
    statusText: '待命'
  },
  {
    id: 'bianjing',
    name: '边境守备军',
    emoji: '🏯',
    color: '#2d6a4f',
    location: '湖州',
    locationEmoji: '🌊',
    type: '守备步兵',
    typeEmoji: '🛡️',
    role: '西境防线，防御南唐',
    troops: 10,
    morale: 70,
    supply: 72,
    combat: 70,
    training: 68,
    commander: 'bj_du',
    viceCommander: 'bj_fu',
    threat: 'south_tang',
    desc: '驻守湖州边境，专门防御南唐方向的威胁，以稳守见长，令南唐不敢轻易进犯。',
    infantry: 70,
    cavalry: 5,
    archers: 20,
    navy: 0,
    engineers: 5,
    grain: 72,
    equipment: 68,
    horses: 8,
    warships: 0,
    specialties: ['坚壁清野','侦察预警'],
    battleRecord: { wins:2, losses:1, draws:3 },
    status: 'standby',
    statusText: '待命'
  }
];

// ===================================================
//  外交国家数据
//  relation: 关系值（0-100，50为中立）
//  threat: 威胁等级 none/low/medium/high/critical
// ===================================================
const NATIONS = [
  {
    id: 'zhou',
    name: '后周',
    emoji: '🏯',
    color: '#c9a84c',
    ruler: '柴荣（周世宗）',
    capital: '汴京',
    relation: 55,
    threat: 'medium',
    status: 'vassal',   // vassal宗主/neutral中立/hostile敌对/ally盟友
    statusText: '宗主国',
    desc: '中原霸主，国力强盛，柴荣锐意改革，军力日盛。吴越名义上奉后周为宗主，每年朝贡。',
    events: ['柴荣正在推行改革，整顿军队，国力蒸蒸日上。'],
    tribute: true,
    lastContact: 0,
  },
  {
    id: 'nantang',
    name: '南唐',
    emoji: '🌸',
    color: '#e74c3c',
    ruler: '李璟（南唐中主）',
    capital: '金陵',
    relation: 35,
    threat: 'high',
    status: 'hostile',
    statusText: '潜在威胁',
    desc: '江南强国，与吴越接壤，觊觎吴越富庶之地。林仁肇等名将虎视眈眈，为吴越最大威胁。',
    events: ['南唐在边境增兵，意图不明。'],
    tribute: false,
    lastContact: 0,
  },
  {
    id: 'min',
    name: '闽国残部',
    emoji: '🌺',
    color: '#e67e22',
    ruler: '（割据势力）',
    capital: '福州',
    relation: 40,
    threat: 'low',
    status: 'neutral',
    statusText: '中立',
    desc: '闽国已分裂，残余势力割据福建，偶有侵扰吴越南境，但整体威胁有限。',
    events: ['闽地割据势力内斗不休，暂无力北顾。'],
    tribute: false,
    lastContact: 0,
  },
  {
    id: 'wuyue_self',
    name: '吴越国',
    emoji: '🐟',
    color: '#3498db',
    ruler: '钱弘俶',
    capital: '杭州',
    relation: 100,
    threat: 'none',
    status: 'self',
    statusText: '本国',
    desc: '保境安民，广纳贤才，以文治武，为乱世中的一片净土。',
    events: [],
    tribute: false,
    lastContact: 0,
  },
  {
    id: 'wuyue_pirates',
    name: '东海海寇',
    emoji: '🏴‍☠️',
    color: '#7f8c8d',
    ruler: '（无固定首领）',
    capital: '—',
    relation: 20,
    threat: 'low',
    status: 'hostile',
    statusText: '海上威胁',
    desc: '活跃于东海的海盗势力，时常骚扰明州、台州沿海，威胁海上贸易。',
    events: ['海寇近期活动频繁，明州商船受到骚扰。'],
    tribute: false,
    lastContact: 0,
  }
];

const MILITARY_OFFICIALS = [
  // 镇海军（杭州，主力）
  { id:'zh_du', name:'孙承祐', role:'镇海军都指挥使', emoji:'⚔️', color:'#8b1a1a', age:50, loyalty:76, ability:82, skill:'步战', trait:'老练', bio:'统领镇海军主力，驻守杭州。历经多次战役，经验丰富，是吴越国最重要的军事将领之一。' },
  { id:'zh_fu', name:'钱弘亿', role:'镇海军副指挥使', emoji:'🗡️', color:'#8b1a1a', age:33, loyalty:82, ability:75, skill:'骑战', trait:'勇猛', bio:'协助统领镇海军，以骑兵作战见长，多次在边境冲突中立功。' },
  { id:'zh_pan', name:'顾承恩', role:'镇海军判官', emoji:'📯', color:'#2c3e50', age:43, loyalty:78, ability:70, skill:'军政', trait:'稳重', bio:'负责镇海军军政事务，处理军队文书、粮草调配，是军队后勤的重要支柱。' },
  // 镇东军（越州）
  { id:'zd_du', name:'吴延福', role:'镇东军都指挥使', emoji:'⚔️', color:'#8b1a1a', age:45, loyalty:79, ability:80, skill:'步战', trait:'勇猛', bio:'统领镇东军，驻守越州。以步兵作战见长，多次击退闽国侵扰。' },
  { id:'zd_fu', name:'林仁肇', role:'镇东军副指挥使', emoji:'🗡️', color:'#8b1a1a', age:30, loyalty:65, ability:88, skill:'水战', trait:'骁勇', bio:'字德润，以骁勇善战著称，尤擅水战。历史上后来投奔南唐，成为南唐名将，需注意其忠诚度。' },
  { id:'zd_pan', name:'钱弘偡', role:'镇东军判官', emoji:'📯', color:'#6b3fa0', age:31, loyalty:84, ability:68, skill:'军政', trait:'忠诚', bio:'钱氏宗室，负责镇东军军政事务，忠心耿耿，是国王在军中的可靠代理人。' },
  // 水师（明州）
  { id:'ws_du', name:'陈承昭', role:'水师都指挥使', emoji:'⛵', color:'#1a3a5c', age:36, loyalty:76, ability:85, skill:'水战', trait:'果断', bio:'统领吴越水师，驻守明州。精通水战，多次击退海寇，保护了吴越的海上利益。' },
  { id:'ws_fu', name:'方仁岳', role:'水师副指挥使', emoji:'🌊', color:'#1a3a5c', age:38, loyalty:72, ability:78, skill:'水战', trait:'机智', bio:'协助统领水师，以机智灵活的战术著称，善于利用地形和潮汐作战。' },
  { id:'ws_pan', name:'黄晟', role:'水师判官', emoji:'📋', color:'#2d6a4f', age:47, loyalty:79, ability:72, skill:'后勤', trait:'精明', bio:'负责水师后勤及港口管理，精通海上贸易，为水师提供充足的物资保障。' },
  // 边境守备军（湖州，防南唐）
  { id:'bj_du', name:'钱弘亿', role:'边境守备都指挥使', emoji:'🏯', color:'#2c3e50', age:33, loyalty:85, ability:76, skill:'守备', trait:'稳重', bio:'统领湖州边境守备军，专门防御南唐方向的威胁。以稳守见长，令南唐不敢轻易进犯。' },
  { id:'bj_fu', name:'沈虎子', role:'边境守备副指挥使', emoji:'⚔️', color:'#8b1a1a', age:40, loyalty:74, ability:73, skill:'步战', trait:'谨慎', bio:'协助统领边境守备军，谨慎稳重，善于侦察敌情，多次提前发现南唐的军事动向。' },
  { id:'bj_pan', name:'林延遇', role:'边境守备判官', emoji:'📯', color:'#2d6a4f', age:37, loyalty:77, ability:69, skill:'军政', trait:'勤勉', bio:'负责边境守备军的军政事务，勤勉尽职，确保边境军队的粮草供应和军纪维持。' }
];

// ===================================================
//  各州郡数据（吴越国十三州）
//  population: 万人  grain: 万石  tax: 万贯/年
//  troops: 驻军（千人）  defense: 城防（0-100）
//  buildings: 已建设施列表  specialty: 特产
//  morale: 民心（0-100）  development: 开发度（0-100）
// ===================================================
const PREFECTURES = [
  {
    id:'hangzhou', name:'杭州', title:'首府·两浙节度', emoji:'🏛️',
    desc:'吴越国都，钱塘江畔，商贾云集，文风鼎盛，为江南第一繁华之地。',
    population: 52, grain: 88, tax: 18, troops: 12, defense: 85,
    morale: 78, development: 88,
    buildings: ['王宫','钱塘海塘','西湖堤坝','翰林院','太庙','市舶司'],
    specialty: '丝绸、茶叶、瓷器',
    governor: 'hz_zhi',
    threat: 'none'
  },
  {
    id:'yuezhou', name:'越州', title:'镇东军节度', emoji:'🌾',
    desc:'吴越粮仓，会稽山下，农业发达，丝绸之乡，历史悠久。',
    population: 38, grain: 120, tax: 12, troops: 8, defense: 72,
    morale: 75, development: 78,
    buildings: ['镇东军营','会稽仓','水利渠网','丝织坊'],
    specialty: '粮食、越布、越窑瓷',
    governor: 'yz_zhi',
    threat: 'none'
  },
  {
    id:'huzhou', name:'湖州', title:'边境要地', emoji:'🌊',
    desc:'太湖之滨，与南唐接壤，水网密布，农桑兴旺，为防御南唐的前沿重镇。',
    population: 28, grain: 75, tax: 9, troops: 10, defense: 68,
    morale: 70, development: 72,
    buildings: ['边境烽燧','太湖水寨','桑蚕坊','粮仓'],
    specialty: '湖丝、太湖鱼鲜',
    governor: 'huz_zhi',
    threat: 'south_tang'
  },
  {
    id:'mingzhou', name:'明州', title:'海贸重港', emoji:'⛵',
    desc:'东海门户，海上丝路起点，商船云集，大食、新罗、日本商人往来不绝。',
    population: 22, grain: 45, tax: 14, troops: 6, defense: 65,
    morale: 80, development: 82,
    buildings: ['明州港','市舶司','水师营','海神庙','商馆区'],
    specialty: '海货、铜钱、舶来品',
    governor: 'mz_zhi',
    threat: 'pirates'
  },
  {
    id:'taizhou', name:'台州', title:'山海之州', emoji:'🏔️',
    desc:'天台山麓，东临大海，山地众多，佛教圣地，民风淳朴。',
    population: 18, grain: 42, tax: 6, troops: 4, defense: 60,
    morale: 72, development: 62,
    buildings: ['天台寺院','梯田工程','海防哨所'],
    specialty: '茶叶、柑橘、海盐',
    governor: 'tz_zhi',
    threat: 'none'
  },
  {
    id:'wenzhou', name:'温州', title:'南方门户', emoji:'🌺',
    desc:'瓯江入海口，南接闽国，商业繁荣，造船业发达，为南方贸易要冲。',
    population: 20, grain: 38, tax: 8, troops: 5, defense: 62,
    morale: 73, development: 68,
    buildings: ['造船坊','瓯江码头','盐场'],
    specialty: '船只、海盐、漆器',
    governor: null,
    threat: 'min'
  },
  {
    id:'suzhou', name:'苏州', title:'鱼米之乡', emoji:'🌸',
    desc:'太湖东岸，水乡泽国，农业富庶，丝织业发达，有"上有天堂，下有苏杭"之誉。',
    population: 35, grain: 95, tax: 13, troops: 7, defense: 70,
    morale: 76, development: 80,
    buildings: ['苏州织造','运河码头','粮仓','书院'],
    specialty: '苏绸、大米、刺绣',
    governor: null,
    threat: 'none'
  },
  {
    id:'changzhou', name:'常州', title:'运河要冲', emoji:'🚢',
    desc:'大运河沿线，水陆交通枢纽，商贸往来频繁，与后周、南唐均有往来。',
    population: 24, grain: 58, tax: 10, troops: 6, defense: 65,
    morale: 68, development: 70,
    buildings: ['运河仓储','驿站','商市'],
    specialty: '布匹、铁器、粮食',
    governor: null,
    threat: 'south_tang'
  },
  {
    id:'runzhou', name:'润州', title:'北境重镇', emoji:'🏯',
    desc:'长江南岸，与后周隔江相望，战略位置极为重要，为吴越北境门户。',
    population: 20, grain: 48, tax: 8, troops: 9, defense: 75,
    morale: 65, development: 65,
    buildings: ['江防要塞','水师营地','烽燧台'],
    specialty: '铁器、军械',
    governor: null,
    threat: 'zhou'
  },
  {
    id:'muzhou', name:'睦州', title:'山区重镇', emoji:'⛰️',
    desc:'新安江上游，山地险峻，林木丰茂，为吴越内陆屏障。',
    population: 14, grain: 32, tax: 5, troops: 4, defense: 58,
    morale: 70, development: 55,
    buildings: ['山寨营垒','木材场'],
    specialty: '木材、茶叶、药材',
    governor: null,
    threat: 'none'
  },
  {
    id:'wuzhou', name:'婺州', title:'内陆腹地', emoji:'🌿',
    desc:'金华盆地，农业发达，手工业兴旺，为吴越内陆重要产粮区。',
    population: 22, grain: 65, tax: 7, troops: 4, defense: 55,
    morale: 74, development: 68,
    buildings: ['粮仓','陶瓷窑','集市'],
    specialty: '粮食、婺州窑瓷、金华火腿',
    governor: null,
    threat: 'none'
  },
  {
    id:'chuzhou', name:'处州', title:'南部山区', emoji:'🌲',
    desc:'括苍山区，山高林密，矿产丰富，与闽国接壤，为南部防线要地。',
    population: 12, grain: 28, tax: 4, troops: 5, defense: 60,
    morale: 68, development: 50,
    buildings: ['矿场','山寨营垒','烽燧'],
    specialty: '铜矿、木材、药材',
    governor: null,
    threat: 'min'
  },
  {
    id:'xiuzhou', name:'秀州', title:'水乡新地', emoji:'🌾',
    desc:'杭嘉湖平原，水网纵横，农业富庶，近年开发迅速，潜力巨大。',
    population: 18, grain: 52, tax: 7, troops: 3, defense: 50,
    morale: 72, development: 60,
    buildings: ['水利渠网','粮仓'],
    specialty: '大米、蚕丝、棉布',
    governor: null,
    threat: 'none'
  }
];

// ===================================================
//  五代十国地图 SVG 数据
// ===================================================
const MAP_CHINA_SVG = `
<svg viewBox="0 0 500 420" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="sea" patternUnits="userSpaceOnUse" width="20" height="20">
      <path d="M0,10 Q5,5 10,10 Q15,15 20,10" stroke="#1a4a6e" stroke-width="0.8" fill="none" opacity="0.4"/>
    </pattern>
  </defs>
  <!-- 海洋背景 -->
  <rect width="500" height="420" fill="#0d2035"/>
  <rect width="500" height="420" fill="url(#sea)"/>

  <!-- 后周（中原，黄色） -->
  <path d="M80,20 L280,20 L300,40 L310,80 L290,120 L260,140 L220,150 L180,145 L140,140 L100,130 L75,100 L70,60 Z"
        fill="#4a3a10" stroke="#c9a84c" stroke-width="1.2" opacity="0.85"/>
  <text x="175" y="90" fill="#e8c97a" font-size="14" font-family="serif" font-weight="bold" text-anchor="middle">后　周</text>
  <text x="175" y="108" fill="#c9a84c" font-size="9" font-family="serif" text-anchor="middle">（中原霸主）</text>

  <!-- 南唐（江淮，绿色） -->
  <path d="M75,100 L140,140 L180,145 L220,150 L230,170 L220,200 L200,220 L170,235 L140,240 L110,230 L85,210 L65,185 L60,155 L65,125 Z"
        fill="#1a3a20" stroke="#40916c" stroke-width="1.2" opacity="0.85"/>
  <text x="145" y="190" fill="#74c69d" font-size="13" font-family="serif" font-weight="bold" text-anchor="middle">南　唐</text>
  <text x="145" y="207" fill="#52b788" font-size="9" font-family="serif" text-anchor="middle">（强邻）</text>

  <!-- 吴越（两浙，金色高亮） -->
  <path d="M220,150 L260,140 L290,145 L310,160 L320,185 L315,215 L300,240 L280,260 L255,270 L230,265 L210,250 L200,230 L200,220 L220,200 L230,170 Z"
        fill="#3a2a05" stroke="#c9a84c" stroke-width="2" opacity="0.95"/>
  <!-- 吴越高亮填充 -->
  <path d="M220,150 L260,140 L290,145 L310,160 L320,185 L315,215 L300,240 L280,260 L255,270 L230,265 L210,250 L200,230 L200,220 L220,200 L230,170 Z"
        fill="rgba(201,168,76,0.15)" stroke="none"/>
  <text x="258" y="205" fill="#e8c97a" font-size="14" font-family="serif" font-weight="bold" text-anchor="middle">吴　越</text>
  <text x="258" y="222" fill="#c9a84c" font-size="9" font-family="serif" text-anchor="middle">（你的国家）</text>
  <!-- 吴越城市 -->
  <circle cx="248" cy="185" r="4" fill="#c9a84c"/>
  <text x="256" y="189" fill="#f5e6c8" font-size="8" font-family="serif">杭州</text>
  <circle cx="275" cy="170" r="3" fill="#c9a84c" opacity="0.8"/>
  <text x="280" y="174" fill="#f5e6c8" font-size="7" font-family="serif">越州</text>
  <circle cx="300" cy="200" r="3" fill="#c9a84c" opacity="0.8"/>
  <text x="305" y="204" fill="#f5e6c8" font-size="7" font-family="serif">明州</text>

  <!-- 闽国（福建，橙色） -->
  <path d="M200,230 L210,250 L230,265 L240,285 L235,310 L215,325 L195,320 L175,305 L165,280 L170,255 L185,240 Z"
        fill="#3a1a05" stroke="#e67e22" stroke-width="1.2" opacity="0.85"/>
  <text x="200" y="285" fill="#f39c12" font-size="12" font-family="serif" font-weight="bold" text-anchor="middle">闽　国</text>

  <!-- 南汉（岭南，紫色） -->
  <path d="M110,230 L140,240 L170,235 L185,240 L175,305 L155,330 L130,345 L100,340 L75,320 L65,295 L70,265 L85,245 Z"
        fill="#2a1a3a" stroke="#9b59b6" stroke-width="1.2" opacity="0.85"/>
  <text x="120" y="290" fill="#bb8fce" font-size="12" font-family="serif" font-weight="bold" text-anchor="middle">南　汉</text>

  <!-- 楚国（湖南，蓝绿） -->
  <path d="M65,185 L85,210 L110,230 L85,245 L70,265 L50,260 L35,240 L30,215 L40,195 Z"
        fill="#0a2a2a" stroke="#1abc9c" stroke-width="1.2" opacity="0.85"/>
  <text x="62" y="228" fill="#76d7c4" font-size="11" font-family="serif" font-weight="bold" text-anchor="middle">楚</text>

  <!-- 后蜀（四川，深绿） -->
  <path d="M30,80 L75,100 L65,125 L60,155 L40,165 L20,155 L10,130 L15,100 Z"
        fill="#0a2a10" stroke="#27ae60" stroke-width="1.2" opacity="0.85"/>
  <text x="42" y="128" fill="#58d68d" font-size="11" font-family="serif" font-weight="bold" text-anchor="middle">后蜀</text>

  <!-- 北汉（山西，灰色） -->
  <path d="M200,20 L280,20 L290,20 L300,40 L290,60 L270,70 L250,65 L230,55 L210,45 Z"
        fill="#1a1a2a" stroke="#7f8c8d" stroke-width="1.2" opacity="0.85"/>
  <text x="250" y="48" fill="#aab7b8" font-size="10" font-family="serif" font-weight="bold" text-anchor="middle">北汉</text>

  <!-- 荆南（湖北，棕色） -->
  <path d="M65,155 L100,130 L140,140 L140,165 L120,180 L95,185 L70,180 Z"
        fill="#2a1a0a" stroke="#d35400" stroke-width="1.2" opacity="0.85"/>
  <text x="103" y="162" fill="#e59866" font-size="10" font-family="serif" font-weight="bold" text-anchor="middle">荆南</text>

  <!-- 东海（右侧） -->
  <text x="380" y="180" fill="#4a9eca" font-size="16" font-family="serif" opacity="0.6" text-anchor="middle">东</text>
  <text x="380" y="200" fill="#4a9eca" font-size="16" font-family="serif" opacity="0.6" text-anchor="middle">海</text>
  <!-- 南海 -->
  <text x="200" y="390" fill="#4a9eca" font-size="14" font-family="serif" opacity="0.5" text-anchor="middle">南　海</text>

  <!-- 契丹（北方） -->
  <path d="M80,20 L200,20 L210,45 L230,55 L220,20 L80,20 Z" fill="none"/>
  <text x="140" y="14" fill="#aab7b8" font-size="10" font-family="serif" opacity="0.6" text-anchor="middle">↑ 契丹（辽）</text>

  <!-- 图例 -->
  <rect x="10" y="355" width="8" height="8" fill="#4a3a10" stroke="#c9a84c" stroke-width="1"/>
  <text x="22" y="363" fill="rgba(245,230,200,0.7)" font-size="8" font-family="serif">后周</text>
  <rect x="55" y="355" width="8" height="8" fill="#1a3a20" stroke="#40916c" stroke-width="1"/>
  <text x="67" y="363" fill="rgba(245,230,200,0.7)" font-size="8" font-family="serif">南唐</text>
  <rect x="100" y="355" width="8" height="8" fill="#3a2a05" stroke="#c9a84c" stroke-width="1.5"/>
  <text x="112" y="363" fill="#e8c97a" font-size="8" font-family="serif" font-weight="bold">吴越</text>
  <rect x="145" y="355" width="8" height="8" fill="#3a1a05" stroke="#e67e22" stroke-width="1"/>
  <text x="157" y="363" fill="rgba(245,230,200,0.7)" font-size="8" font-family="serif">闽国</text>
  <rect x="185" y="355" width="8" height="8" fill="#2a1a3a" stroke="#9b59b6" stroke-width="1"/>
  <text x="197" y="363" fill="rgba(245,230,200,0.7)" font-size="8" font-family="serif">南汉</text>
</svg>`;

const MAP_WUYUE_SVG = `
<svg viewBox="0 0 320 360" xmlns="http://www.w3.org/2000/svg">
  <rect width="320" height="360" fill="#0d2035"/>
  <!-- 东海 -->
  <path d="M220,0 L320,0 L320,360 L220,360 Z" fill="#0a1a2e" opacity="0.8"/>
  <text x="270" y="180" fill="#4a9eca" font-size="14" font-family="serif" opacity="0.6" text-anchor="middle">东　海</text>

  <!-- 吴越国领土 -->
  <path d="M30,30 L90,15 L150,10 L200,20 L220,45 L225,80 L215,120 L200,155 L185,185 L165,210 L145,235 L120,255 L95,265 L70,258 L50,240 L35,215 L22,185 L18,150 L20,110 L25,70 Z"
        fill="#2d5a27" stroke="#c9a84c" stroke-width="2" opacity="0.9"/>
  <path d="M30,30 L90,15 L150,10 L200,20 L220,45 L225,80 L215,120 L200,155 L185,185 L165,210 L145,235 L120,255 L95,265 L70,258 L50,240 L35,215 L22,185 L18,150 L20,110 L25,70 Z"
        fill="rgba(201,168,76,0.08)" stroke="none"/>

  <!-- 山脉 -->
  <path d="M60,50 L75,35 L90,50 M95,60 L110,42 L125,60 M130,50 L145,32 L160,50 M160,70 L175,52 L190,70"
        stroke="#4a7a44" stroke-width="1.5" fill="none" opacity="0.6"/>
  <!-- 钱塘江 -->
  <path d="M22,155 Q60,140 100,150 Q145,162 185,155"
        stroke="#4a9eca" stroke-width="2.5" fill="none" opacity="0.8"/>
  <text x="100" y="145" fill="#4a9eca" font-size="8" font-family="serif" opacity="0.7">钱塘江</text>
  <!-- 太湖 -->
  <ellipse cx="55" cy="110" rx="22" ry="14" fill="#1a4a6e" opacity="0.6" stroke="#4a9eca" stroke-width="1"/>
  <text x="55" y="114" fill="#4a9eca" font-size="7" font-family="serif" text-anchor="middle">太湖</text>

  <!-- 州城 -->
  <circle cx="115" cy="140" r="7" fill="#c9a84c" opacity="0.95"/>
  <text x="125" y="144" fill="#f5e6c8" font-size="11" font-family="serif" font-weight="bold">杭州（首府）</text>
  <circle cx="170" cy="105" r="5" fill="#c9a84c" opacity="0.8"/>
  <text x="178" y="109" fill="#f5e6c8" font-size="9" font-family="serif">越州</text>
  <circle cx="65" cy="130" r="5" fill="#c9a84c" opacity="0.8"/>
  <text x="73" y="134" fill="#f5e6c8" font-size="9" font-family="serif">湖州</text>
  <circle cx="195" cy="155" r="5" fill="#c9a84c" opacity="0.8"/>
  <text x="203" y="159" fill="#f5e6c8" font-size="9" font-family="serif">明州</text>
  <circle cx="185" cy="185" r="4" fill="#c9a84c" opacity="0.7"/>
  <text x="193" y="189" fill="#f5e6c8" font-size="8" font-family="serif">台州</text>
  <circle cx="155" cy="215" r="4" fill="#c9a84c" opacity="0.7"/>
  <text x="163" y="219" fill="#f5e6c8" font-size="8" font-family="serif">温州</text>
  <circle cx="90" cy="80" r="4" fill="#c9a84c" opacity="0.7"/>
  <text x="98" y="84" fill="#f5e6c8" font-size="8" font-family="serif">苏州</text>
  <circle cx="45" cy="165" r="4" fill="#c9a84c" opacity="0.7"/>
  <text x="53" y="169" fill="#f5e6c8" font-size="8" font-family="serif">睦州</text>
  <circle cx="130" cy="195" r="4" fill="#c9a84c" opacity="0.7"/>
  <text x="138" y="199" fill="#f5e6c8" font-size="8" font-family="serif">婺州</text>
  <circle cx="100" cy="230" r="4" fill="#c9a84c" opacity="0.7"/>
  <text x="108" y="234" fill="#f5e6c8" font-size="8" font-family="serif">处州</text>

  <!-- 邻国标注 -->
  <text x="15" y="25" fill="#74c69d" font-size="10" font-family="serif" opacity="0.7">← 南唐</text>
  <text x="15" y="290" fill="#f39c12" font-size="10" font-family="serif" opacity="0.7">← 闽国</text>
  <text x="100" y="15" fill="#aab7b8" font-size="9" font-family="serif" opacity="0.6">↑ 后周（中原）</text>

  <!-- 国名 -->
  <text x="100" y="175" fill="#e8c97a" font-size="18" font-family="serif" font-weight="bold" opacity="0.25" text-anchor="middle">吴　越　国</text>
</svg>`;

// ===================================================
//  8大系统行动定义
// ===================================================
// oncePerYear: 每年只能执行一次
// energyCost: 消耗国王精力（默认0）
const SYSTEMS = {
  zhengwu: {
    name:'政务', icon:'📋', color:'#c9a84c',
    desc:'处理朝廷日常政务，整顿吏治，推行政令',
    actions: [
      { id:'event',    icon:'📋', name:'处理政务', baseCost:0,  desc:'处理一件随机政务事件（随机收益，可多次处理）', highlight:true },
      { id:'exam',     icon:'🎓', name:'开科举',   baseCost:15, desc:'举办科举考试，选拔人才（每年一次，基础花费15万贯）', oncePerYear:true },
      { id:'tour',     icon:'🚶', name:'微服私访', baseCost:3,  desc:'乔装出行，了解民情（消耗精力20，每年一次）', oncePerYear:true, energyCost:20 },
      { id:'anticorr', icon:'⚖️', name:'整顿吏治', baseCost:10, desc:'严查贪腐，整肃官场风气（每年一次，基础花费10万贯）', oncePerYear:true }
    ]
  },
  junshi: {
    name:'军事', icon:'⚔️', color:'#e74c3c',
    desc:'统领军队，强化边防，应对外敌威胁',
    actions: [
      { id:'military',      icon:'⚔️', name:'检阅军队',   baseCost:5,  desc:'亲自检阅军队，提振士气（消耗精力15，每年一次）', oncePerYear:true, energyCost:15 },
      { id:'drill',         icon:'🗡️', name:'军事演练',   baseCost:20, desc:'组织大规模军事演练，提升战力（每年一次，基础花费20万贯）', oncePerYear:true },
      { id:'fortify',       icon:'🏯', name:'修缮城防',   baseCost:25, desc:'加固边境城池，完善防御工事（每年一次，基础花费25万贯）', oncePerYear:true },
      { id:'recruit',       icon:'📯', name:'募兵扩军',   baseCost:30, desc:'招募新兵，扩充军队规模（每年一次，基础花费30万贯）', oncePerYear:true },
      { id:'new_army',      icon:'🏕️', name:'新建军队',   baseCost:50, desc:'组建一支新的军队，设置驻地与兵种（基础花费50万贯）', modal:'newArmy' },
      { id:'appoint_cmd',   icon:'👑', name:'任命将领',   baseCost:0,  desc:'为各军任命主帅或副帅，调整将领配置', modal:'appointCmd' },
      { id:'alloc_supply',  icon:'🌾', name:'划拨粮草',   baseCost:0,  desc:'向各军划拨粮草与军械，调整物资分配', modal:'allocSupply' },
      { id:'plan_troops',   icon:'🗺️', name:'规划兵种',   baseCost:10, desc:'调整各军兵种构成，优化战术配置（基础花费10万贯）', modal:'planTroops' },
      { id:'equip_upgrade', icon:'⚙️', name:'更新军械',   baseCost:35, desc:'为军队更换精良武器装备，提升装备完好度（每年一次，基础花费35万贯）', oncePerYear:true },
      { id:'prepare_war',   icon:'🔥', name:'备战动员',   baseCost:15, desc:'全国备战，提升军队战备状态（每年一次，基础花费15万贯）', oncePerYear:true, highlight:false },
      { id:'declare_war',   icon:'⚔️', name:'宣战出征',   baseCost:40, desc:'向邻国宣战，发动战争！（基础花费40万贯）', highlight:true }
    ]
  },
  waijiao: {
    name:'外交', icon:'🏮', color:'#3498db',
    desc:'处理与周边诸国的外交关系，维护和平',
    actions: [
      { id:'diplomacy', icon:'🏮', name:'遣使出访', baseCost:10, desc:'派遣使节，处理外交事务（每年一次，基础花费10万贯）', oncePerYear:true },
      { id:'tribute',   icon:'🎁', name:'朝贡中原', baseCost:20, desc:'向后周进贡，维系宗主关系（每年一次，基础花费20万贯）', oncePerYear:true },
      { id:'spy',       icon:'🕵️', name:'情报刺探', baseCost:8,  desc:'派遣密探，刺探邻国情报（每年一次，基础花费8万贯）', oncePerYear:true },
      { id:'alliance',  icon:'🤝', name:'结盟谋划', baseCost:15, desc:'秘密联络他国，谋划战略同盟（每年一次，基础花费15万贯）', oncePerYear:true },
      { id:'sue_peace', icon:'🕊️', name:'遣使求和', baseCost:25, desc:'战时可向敌国求和，结束战争（基础花费25万贯）' }
    ]
  },
  jingji: {
    name:'经济', icon:'💰', color:'#2ecc71',
    desc:'发展工商贸易，充实国库，繁荣经济',
    actions: [
      { id:'trade',    icon:'⛵', name:'开拓海贸', baseCost:20, desc:'扩大海上贸易往来（每年一次，基础花费20万贯）', oncePerYear:true },
      { id:'market',   icon:'🏪', name:'兴建市集', baseCost:15, desc:'在各州兴建市集，促进商业流通（每年一次，基础花费15万贯）', oncePerYear:true },
      { id:'tax',      icon:'📊', name:'调整税制', baseCost:5,  desc:'改革税收制度，平衡财政收支（每年一次，基础花费5万贯）', oncePerYear:true },
      { id:'mint',     icon:'🪙', name:'铸造钱币', baseCost:12, desc:'统一铸造货币，稳定物价（每年一次，基础花费12万贯）', oncePerYear:true }
    ]
  },
  minsheng: {
    name:'民生', icon:'🌾', color:'#f39c12',
    desc:'关注百姓疾苦，改善民生，安定社会',
    actions: [
      { id:'build',    icon:'🏗️', name:'兴修水利', baseCost:25, desc:'组织修建水利工程，保障农业（每年一次，基础花费25万贯）', oncePerYear:true },
      { id:'relief',   icon:'🌾', name:'赈济灾民', baseCost:15, desc:'开仓放粮，救济受灾百姓（基础花费15万贯）' },
      { id:'medicine', icon:'💊', name:'设立医馆', baseCost:10, desc:'在各地设立医馆，救治百姓（每年一次，基础花费10万贯）', oncePerYear:true },
      { id:'school',   icon:'📚', name:'兴办学堂', baseCost:18, desc:'在各州兴办学堂，推广教化（每年一次，基础花费18万贯）', oncePerYear:true }
    ]
  },
  jisi: {
    name:'祭祀', icon:'🛕', color:'#9b59b6',
    desc:'举行祭祀典礼，礼佛祈福，凝聚人心',
    actions: [
      { id:'religion', icon:'🛕', name:'礼佛祈福', baseCost:8,  desc:'礼佛祈福，安抚民心（消耗精力10，每年一次）', oncePerYear:true, energyCost:10 },
      { id:'temple',   icon:'⛩️', name:'修建寺庙', baseCost:30, desc:'广建寺庙，弘扬佛法（每年一次，基础花费30万贯）', oncePerYear:true },
      { id:'ritual',   icon:'🎋', name:'祭天大典', baseCost:20, desc:'举行祭天大典，彰显王权（消耗精力15，每年一次）', oncePerYear:true, energyCost:15 },
      { id:'poetry',   icon:'🌸', name:'西湖诗会', baseCost:10, desc:'举办诗会，繁荣文化（消耗精力10，每年一次）', oncePerYear:true, energyCost:10 }
    ]
  },
  zongshi: {
    name:'宗室', icon:'🏛️', color:'#1abc9c',
    desc:'管理钱氏宗族，安抚宗室，稳固王权',
    actions: [
      { id:'clan',     icon:'🏛️', name:'宗室会议', baseCost:5,  desc:'召集宗室重臣，商议国事（消耗精力10，每年一次）', oncePerYear:true, energyCost:10 },
      { id:'appoint',  icon:'📜', name:'委任宗亲', baseCost:8,  desc:'委任钱氏宗亲担任要职（每年一次，基础花费8万贯）', oncePerYear:true },
      { id:'reward',   icon:'🎖️', name:'封赏功臣', baseCost:15, desc:'封赏有功宗室及臣子（每年一次，基础花费15万贯）', oncePerYear:true },
      { id:'heir',     icon:'👑', name:'培育储君', baseCost:12, desc:'悉心培育太子，确保王位传承（消耗精力15，每年一次）', oncePerYear:true, energyCost:15 }
    ]
  },
  hougong: {
    name:'后宫', icon:'💐', color:'#e91e8c',
    desc:'管理后宫事务，联姻结盟，稳固内廷',
    actions: [
      { id:'consort',  icon:'💐', name:'选妃纳贤', baseCost:10, desc:'充实后宫，联姻结盟（每年一次，基础花费10万贯）', oncePerYear:true },
      { id:'banquet',  icon:'🍷', name:'宫廷宴会', baseCost:8,  desc:'举办宫廷宴会，笼络人心（消耗精力10，每年一次）', oncePerYear:true, energyCost:10 },
      { id:'marriage', icon:'💍', name:'联姻外邦', baseCost:20, desc:'以宗室女联姻邻国，巩固外交（每年一次，基础花费20万贯）', oncePerYear:true },
      { id:'harem',    icon:'🌺', name:'整顿后宫', baseCost:5,  desc:'整顿后宫秩序，杜绝干政（每年一次，基础花费5万贯）', oncePerYear:true }
    ]
  }
};

// ===================================================
//  事件库
// ===================================================
const EVENTS = [
  { id:'flood', tag:'urgent', tagText:'急报', title:'钱塘江决堤',
    scene:'深夜，急报传来。钱塘江沿岸连日暴雨，堤坝告急，数万百姓面临洪涝之灾。',
    desc:'钱塘江水位暴涨，沿岸湖州、杭州数县告急。地方官员请求朝廷拨款修缮堤坝，安置灾民。若不及时处置，恐有民变之忧。',
    advisor:'wu_chengyi', advisorText:'大王，钱塘江乃吴越命脉，历代先王皆重视水利。臣以为当速拨国库钱粮，征调民夫修缮堤坝，此乃当务之急。',
    choices:[
      { label:'【仁政赈灾】', text:'倾力赈灾，拨出大量钱粮，亲派官员督修堤坝，安置灾民', cost:18, effect:{people:+6,culture:+2}, result:{icon:'🌊',title:'仁政爱民',desc:'大王亲力亲为，赈灾得力。百姓感念王恩，纷纷称颂。钱塘江堤坝修缮一新，此后数年再无水患。',type:'good'} },
      { label:'【以工代赈】', text:'拨出部分钱粮，征调民夫以工代赈修缮堤坝', cost:8, effect:{people:+2,military:+1}, result:{icon:'📜',title:'稳妥处置',desc:'以工代赈之策颇为得当，既安抚了灾民，又节省了国库开支。堤坝修缮完毕，百姓生活逐渐恢复。',type:'neutral'} },
      { label:'【令地方自筹】', text:'命地方自行筹措，朝廷仅拨少量钱粮', cost:3, effect:{people:-8,military:-3}, result:{icon:'😤',title:'民怨渐起',desc:'朝廷赈灾不力，灾民流离失所，民间怨声载道。部分地方豪强趁机煽动，局势颇为不稳。',type:'bad'} }
    ]},
  { id:'tax_reform', tag:'normal', tagText:'政务', title:'税制改革之议',
    scene:'朝堂之上，群臣就税制改革争论不休。',
    desc:'吴越国税制沿用旧制，商贾负担沉重，而农民却时有欠税之困。丞相曹忠达提议改革税制，减轻商税以促贸易，同时整顿田赋。',
    advisor:'cao_zhongda', advisorText:'大王，吴越地处江南，商贸繁盛乃立国之本。若能减轻商税，引来四方商贾，国库收入反而会增加。臣请大王圣裁。',
    choices:[
      { label:'【推行改革】', text:'推行税制改革，减轻商税，整顿田赋，鼓励工商', cost:5, effect:{people:+3,culture:+2,diplomacy:+2}, result:{icon:'💹',title:'商贸繁荣',desc:'税制改革初见成效，四方商贾云集杭州，市井繁华，国库收入稳步增长。',type:'good'} },
      { label:'【小幅调整】', text:'维持现有税制，仅作小幅调整，以稳为主', cost:2, effect:{people:+1}, result:{icon:'⚖️',title:'稳中求进',desc:'税制小幅调整，局势平稳。虽无大的改变，但也避免了改革带来的风险。',type:'neutral'} },
      { label:'【趁机增税】', text:'趁机增加赋税，充实国库，以备军事之需', cost:0, effect:{people:-6,military:+2}, result:{icon:'💸',title:'民怨沸腾',desc:'赋税加重，百姓苦不堪言。虽然短期内充实了国库，但民间怨声四起。',type:'bad'} }
    ]},
  { id:'drought', tag:'urgent', tagText:'天灾', title:'越州大旱',
    scene:'越州刺史快马来报，当地已三月未见雨水，田地龟裂，粮食歉收。',
    desc:'越州大旱，粮食减产七成。百姓已开始食树皮、草根，饿殍渐现。若不及时救援，恐有大批流民涌入杭州，动摇国本。',
    advisor:'wu_chengyi', advisorText:'大王，越州乃吴越粮仓，此次大旱非同小可。臣建议开仓放粮，同时向南唐购粮，以解燃眉之急。',
    choices:[
      { label:'【开仓放粮】', text:'立即开仓放粮，同时向南唐购粮，全力救灾', cost:20, effect:{people:+7,diplomacy:+2}, result:{icon:'🌾',title:'救民于水火',desc:'大王开仓放粮，百姓得以度过难关。越州百姓感恩戴德，立碑颂德。',type:'good'} },
      { label:'【以工代赈】', text:'组织灾民修建水利，以工换粮，同时减免越州赋税', cost:10, effect:{people:+4,culture:+3}, result:{icon:'🏗️',title:'兴修水利',desc:'以工代赈之策既解了灾情，又修建了水利设施，为日后农业生产奠定基础。',type:'good'} },
      { label:'【坐视不理】', text:'认为地方自有应对之策，朝廷无需过多干预', cost:0, effect:{people:-10,military:-4}, result:{icon:'💀',title:'民心尽失',desc:'朝廷袖手旁观，越州饿殍遍野，大批流民涌入杭州。民间开始流传"无道昏君"之说。',type:'bad'} }
    ]},
  { id:'south_tang', tag:'crisis', tagText:'军情', title:'南唐陈兵边境',
    scene:'边境急报：南唐大将林仁肇率兵五万，屯驻于吴越西境，意图不明。',
    desc:'南唐国力强盛，一直觊觎吴越富庶之地。此次陈兵边境，或为试探，或为真正进犯。大将军请求增兵边境，丞相则主张外交斡旋。',
    advisor:'wu_yanfu', advisorText:'大王！南唐此举分明是欺我吴越！末将请命，率精兵三万迎击，让南唐知道我吴越男儿不是好欺负的！',
    choices:[
      { label:'【联周制唐】', text:'增兵边境，同时秘密联络后周牵制南唐，以强示弱', cost:15, effect:{military:+5,diplomacy:+3,people:-2}, result:{icon:'⚔️',title:'以强示弱',desc:'吴越增兵边境，南唐见吴越有备，且后周虎视眈眈，遂撤兵而去。军威大振。',type:'good'} },
      { label:'【外交斡旋】', text:'派遣使者携厚礼赴南唐，以外交手段化解危机', cost:10, effect:{diplomacy:+5,military:-2,people:+2}, result:{icon:'🏮',title:'和平化解',desc:'使者能言善辩，南唐接受厚礼，双方达成协议，边境恢复平静。',type:'neutral'} },
      { label:'【称臣纳贡】', text:'主动向南唐称臣，每年纳贡，换取和平', cost:20, effect:{diplomacy:-5,people:-8,culture:-3}, result:{icon:'😔',title:'屈辱求和',desc:'吴越主动称臣，南唐撤兵。然而此举令朝野震动，百姓颇感屈辱。',type:'bad'} }
    ]},
  { id:'pirate', tag:'urgent', tagText:'海患', title:'海寇侵扰',
    scene:'明州港口告急，一支海寇船队袭击了沿海渔村，劫掠财物，杀伤百姓。',
    desc:'东海海寇猖獗，已连续袭击明州、台州沿海数处，百姓苦不堪言。大将军请求组建水师，彻底剿灭海寇。',
    advisor:'ws_du', advisorText:'大王，海寇之患不除，沿海百姓永无宁日！末将愿率水师出海，将这些贼寇斩草除根！',
    choices:[
      { label:'【组建水师】', text:'拨款组建精锐水师，彻底剿灭海寇', cost:18, effect:{military:+6,people:+4}, result:{icon:'⛵',title:'海清河晏',desc:'吴越水师横扫东海，海寇覆灭。沿海百姓欢欣鼓舞，商船往来无阻，海上贸易大为繁荣。',type:'good'} },
      { label:'【招安海寇】', text:'派人招安海寇首领，许以官职，化敌为友', cost:5, effect:{military:+3,diplomacy:+2,people:+2}, result:{icon:'🤝',title:'化敌为友',desc:'海寇首领接受招安，率部归顺。这支水上力量成为吴越水师的重要补充。',type:'good'} },
      { label:'【坚壁清野】', text:'命沿海百姓内迁，放弃沿海地区，以避海寇锋芒', cost:5, effect:{people:-8,military:-3}, result:{icon:'😢',title:'百姓流离',desc:'沿海百姓被迫内迁，失去家园，怨声载道。海寇更加猖獗。',type:'bad'} }
    ]},
  { id:'scholar', tag:'good', tagText:'文事', title:'招揽天下名士',
    scene:'翰林学士林德元上奏，建议广开门路，招揽中原战乱中流离失所的文人学士。',
    desc:'中原战乱频仍，大批文人学士南下避难。若能招揽这些人才，不仅能充实朝廷，更能提升吴越的文化声望。',
    advisor:'lin_deyuan', advisorText:'大王，乱世之中，人才最为宝贵。中原名士多有南下者，若大王能礼贤下士，广纳贤才，吴越必将文风大盛！',
    choices:[
      { label:'【广纳贤才】', text:'大力招揽，给予优厚待遇，建立书院，广开科举', cost:10, effect:{culture:+7,diplomacy:+3,people:+2}, result:{icon:'📚',title:'文风大盛',desc:'吴越广纳贤才，杭州成为江南文化中心。诗词歌赋盛行，书院林立，吴越文化声望大振。',type:'good'} },
      { label:'【择优录用】', text:'设立考核，择优录用，量才而用', cost:4, effect:{culture:+4,diplomacy:+1}, result:{icon:'🎓',title:'人才济济',desc:'经过考核，一批真正有才学的人士进入朝廷，为吴越的治理贡献力量。',type:'neutral'} },
      { label:'【婉言谢绝】', text:'以国库紧张为由，暂不大规模招揽', cost:0, effect:{culture:-3}, result:{icon:'📝',title:'错失良机',desc:'吴越错失了招揽人才的良机，部分名士转投他国，令人惋惜。',type:'bad'} }
    ]},
  { id:'zhou_tribute', tag:'diplomacy', tagText:'外交', title:'后周使者来访',
    scene:'后周天子遣使来访，要求吴越增加岁贡，并提供军粮支援后周北伐。',
    desc:'后周国力强盛，是吴越最重要的宗主国。使者态度强硬，要求增加岁贡三成，并提供军粮十万石支援北伐。',
    advisor:'cao_zhongda', advisorText:'大王，后周乃天下共主，我吴越向来奉行"保境安民"之策，与中原保持良好关系至关重要。臣以为可适当满足，但需讨价还价。',
    choices:[
      { label:'【慷慨应允】', text:'全部答应后周要求，表示忠心，换取后周庇护', cost:20, effect:{diplomacy:+6,people:-3}, result:{icon:'🏮',title:'宗主满意',desc:'后周天子对吴越的忠诚大为满意，赐予吴越王更高封号，并承诺保护吴越不受他国侵犯。',type:'neutral'} },
      { label:'【讨价还价】', text:'与使者周旋，答应增加岁贡但减少军粮，并要求后周给予贸易优惠', cost:10, effect:{diplomacy:+3,culture:+2}, result:{icon:'🤝',title:'外交得当',desc:'经过一番周旋，双方达成折中协议。吴越既维护了与后周的关系，又保住了部分利益。',type:'good'} },
      { label:'【婉言推辞】', text:'以国内灾情为由，请求减免，同时暗中联络南唐以为后盾', cost:0, effect:{diplomacy:-4,military:+2}, result:{icon:'⚠️',title:'关系紧张',desc:'后周使者不满而归，两国关系趋于紧张。虽然节省了开支，但吴越的处境更加微妙。',type:'bad'} }
    ]},
  { id:'silk_road', tag:'good', tagText:'商贸', title:'大食商人来访',
    scene:'明州港口，一支来自大食国的商船队抵港，带来了珍贵的香料和宝石。',
    desc:'大食商人希望与吴越建立长期贸易关系，在明州设立商馆。此举将大大促进吴越的海上贸易。',
    advisor:'mz_zhi', advisorText:'大王，吴越地处东海之滨，海上贸易乃天赐之利！若能与大食建立贸易往来，丝绸、瓷器、茶叶皆可换取大量财富！',
    choices:[
      { label:'【大力发展】', text:'投资扩建明州港口，给予大食商人优惠政策，大力发展海上贸易', cost:12, effect:{diplomacy:+5,culture:+3,people:+2}, result:{icon:'⛵',title:'海贸繁荣',desc:'明州港口日益繁荣，来自大食、新罗、日本的商船络绎不绝。吴越丝绸、瓷器远销海外，国库充盈。',type:'good'} },
      { label:'【谨慎开放】', text:'允许贸易，但设立严格管控，防止外商势力过大', cost:4, effect:{diplomacy:+2}, result:{icon:'📦',title:'稳健发展',desc:'海上贸易稳步发展，国库收入有所增加，但规模有限。',type:'neutral'} },
      { label:'【闭关自守】', text:'以安全为由，拒绝外商入驻', cost:0, effect:{diplomacy:-3}, result:{icon:'🚫',title:'错失良机',desc:'大食商人转赴他处，吴越错失了发展海上贸易的良机。',type:'bad'} }
    ]},
  { id:'corrupt', tag:'urgent', tagText:'弹劾', title:'贪官污吏案',
    scene:'御史台呈上弹劾奏折，湖州刺史贪污赈灾款项，中饱私囊，百姓苦不堪言。',
    desc:'湖州刺史王某贪污赈灾款项达万贯，致使灾民未能得到救助。此案证据确凿，但王某与朝中数位重臣有所往来。',
    advisor:'chen_yue', advisorText:'大王，此案证据确凿，若不严惩，朝廷威信何在？然王某与数位重臣有所关联，处置需要慎重，以免引起朝堂动荡。',
    choices:[
      { label:'【严惩不贷】', text:'依法严惩，抄家问斩，以儆效尤', cost:0, effect:{people:+5,culture:+4,military:-2,diplomacy:-2}, result:{icon:'⚖️',title:'铁腕反腐',desc:'大王铁腕反腐，王某被依法处置，家产充公。百姓拍手称快，朝廷威信大振。',type:'good'} },
      { label:'【革职查办】', text:'革去官职，追缴赃款，但念其有功，免于极刑', cost:0, effect:{people:+3,culture:+2}, result:{icon:'📋',title:'依法处置',desc:'王某被革职，赃款追缴归还灾民。此举既维护了法纪，又避免了朝堂动荡。',type:'neutral'} },
      { label:'【大事化小】', text:'念其往日功劳，仅作降职处理，私下警告', cost:0, effect:{people:-5,culture:-4}, result:{icon:'😤',title:'姑息养奸',desc:'大王包庇贪官，消息传出，百姓大失所望。朝中贪腐之风愈演愈烈。',type:'bad'} }
    ]},
  { id:'harvest', tag:'good', tagText:'喜报', title:'五谷丰登',
    scene:'秋收时节，各地刺史纷纷来报，今年风调雨顺，粮食大丰收。',
    desc:'今年吴越风调雨顺，粮食大丰收，比往年增产三成。如何处置这笔额外的粮食收入？',
    advisor:'wu_chengyi', advisorText:'大王，今年大丰收，实乃天佑吴越！臣建议将部分粮食储入官仓，以备不时之需，同时适当减免赋税，与民同乐。',
    choices:[
      { label:'【与民同乐】', text:'大幅减免赋税，举办庆典，与民同乐', cost:5, effect:{people:+6,culture:+3}, result:{icon:'🎉',title:'普天同庆',desc:'大王减免赋税，举办庆典，吴越百姓欢欣鼓舞。此举大得民心，百姓对大王感恩戴德。',type:'good'} },
      { label:'【充实国库】', text:'将丰收粮食大部分收入国库，以备军事和灾害之需', cost:0, effect:{people:+2,military:+2}, result:{icon:'💰',title:'未雨绸缪',desc:'国库充盈，为日后应对各种危机奠定了基础。',type:'good'} },
      { label:'【扩充军备】', text:'将丰收收入用于扩充军备，增强国防', cost:8, effect:{military:+5,people:-2}, result:{icon:'⚔️',title:'强兵备战',desc:'军备得到充实，吴越军力大增。但百姓希望减税的愿望落空，略有失望。',type:'neutral'} }
    ]},
  { id:'epidemic', tag:'urgent', tagText:'疫情', title:'瘟疫肆虐',
    scene:'越州急报：城中突发瘟疫，已有数百人染病，死亡数十人，疫情有蔓延之势。',
    desc:'越州爆发瘟疫，疫情迅速蔓延。若不及时控制，恐将波及整个吴越。需要大量药材和医者。',
    advisor:'cao_zhongda', advisorText:'大王，瘟疫之事刻不容缓！臣建议立即封锁疫区，征召天下名医，同时从国库拨款购买药材。',
    choices:[
      { label:'【全力防治】', text:'封锁疫区，征召名医，大量购买药材，全力防治', cost:18, effect:{people:+5,culture:+3}, result:{icon:'💊',title:'疫情控制',desc:'大王全力防治，疫情得到控制，死亡人数大为减少。百姓感念大王仁德。',type:'good'} },
      { label:'【隔离封锁】', text:'严格封锁疫区，防止蔓延，但不大规模投入资源', cost:6, effect:{people:-2,military:+1}, result:{icon:'🚧',title:'隔离控制',desc:'疫区被封锁，疫情未能大规模蔓延，但疫区百姓死亡较多，对大王颇有怨言。',type:'neutral'} },
      { label:'【听之任之】', text:'认为瘟疫乃天意，不作过多干预', cost:0, effect:{people:-10,military:-4}, result:{icon:'💀',title:'疫情失控',desc:'瘟疫迅速蔓延，死亡人数急剧增加。百姓对朝廷失望至极，部分地区出现逃亡潮。',type:'bad'} }
    ]},
  { id:'poetry', tag:'good', tagText:'雅事', title:'西湖诗会',
    scene:'春日西湖，百花盛开，翰林学士提议举办一场盛大的诗会，邀请天下文人雅士。',
    desc:'西湖诗会是吴越的文化盛事，历代先王皆有举办。此次诗会若能盛大举行，将大大提升吴越的文化声望。',
    advisor:'lin_deyuan', advisorText:'大王，西湖诗会乃吴越文化之盛事！若大王能亲临赋诗，必将传为佳话，吴越文名将远播四海！',
    choices:[
      { label:'【盛大举办】', text:'大力支持，亲临诗会，广邀天下文人', cost:10, effect:{culture:+6,diplomacy:+3,people:+3}, result:{icon:'🌸',title:'文化盛事',desc:'西湖诗会盛况空前，大王亲临赋诗，佳作传颂天下。吴越文化声望大振，四方文人纷纷慕名而来。',type:'good'} },
      { label:'【简单举办】', text:'举办诗会，但规模适中，不过分铺张', cost:4, effect:{culture:+3,people:+2}, result:{icon:'🎋',title:'雅集成功',desc:'诗会举办成功，文人雅士尽兴而归，吴越文化氛围更加浓厚。',type:'neutral'} },
      { label:'【取消诗会】', text:'以国事繁忙为由，取消诗会', cost:0, effect:{culture:-4,people:-2}, result:{icon:'😞',title:'文人失望',desc:'诗会取消，文人雅士大失所望，部分人离开吴越，文化氛围有所下降。',type:'bad'} }
    ]},
  { id:'spy_caught', tag:'crisis', tagText:'密报', title:'南唐奸细',
    scene:'密探来报，在杭州城内抓获一名南唐奸细，其身上携有吴越军事部署图。',
    desc:'南唐奸细被捕，审讯得知南唐已在吴越境内布置了多名细作，专门刺探军事情报。',
    advisor:'shen_chongyi', advisorText:'大王，此事需谨慎处理。若大张旗鼓，恐引起南唐警觉，反而不利。臣建议秘密处置，同时加强内部防范。',
    choices:[
      { label:'【秘密处置】', text:'秘密处决奸细，同时清查境内细作，加强情报工作', cost:3, effect:{military:+4,diplomacy:+2,culture:+2}, result:{icon:'🕵️',title:'情报得力',desc:'奸细被秘密处决，境内细作网络被逐步清除。吴越情报工作大为加强。',type:'good'} },
      { label:'【公开谴责】', text:'将此事公开，向南唐提出强烈抗议，要求道歉', cost:0, effect:{diplomacy:-4,military:+2,people:+3}, result:{icon:'📢',title:'外交风波',desc:'吴越公开谴责南唐，两国关系趋于紧张。但此举也让百姓看到了大王的强硬立场。',type:'neutral'} },
      { label:'【以彼之道】', text:'将奸细策反，同时向南唐派遣己方细作', cost:5, effect:{military:+3,diplomacy:-2,culture:-1}, result:{icon:'🎭',title:'间谍战',desc:'奸细被策反，成为双面间谍。吴越也开始在南唐境内布置细作，情报战愈演愈烈。',type:'neutral'} }
    ]},
  { id:'invention', tag:'good', tagText:'奇技', title:'工匠献宝',
    scene:'一名工匠求见，声称发明了一种新式农具，可大幅提高耕作效率。',
    desc:'工匠陈阿大发明了一种新式曲辕犁，据称可将耕作效率提高一倍。若能推广，将大大增加粮食产量。',
    advisor:'wu_chengyi', advisorText:'大王，臣亲自试验过这种新犁，效果确实惊人！若能在全国推广，吴越的粮食产量将大幅提升！',
    choices:[
      { label:'【大力推广】', text:'拨款大力推广新式农具，并给予发明者重赏', cost:8, effect:{people:+4,culture:+3,agri:+3}, result:{icon:'🌾',title:'农业革新',desc:'新式农具在全国推广，粮食产量大幅提升。工匠陈阿大被封为"农事官"，吴越农业技术领先诸国。',type:'good'} },
      { label:'【试点推行】', text:'先在部分地区试点，观察效果后再决定是否全面推广', cost:3, effect:{people:+2,culture:+2,agri:+1}, result:{icon:'🔬',title:'稳步推进',desc:'试点地区效果良好，新式农具逐步推广。虽然进度较慢，但风险可控。',type:'neutral'} },
      { label:'【婉言谢绝】', text:'认为此乃奇技淫巧，不予采纳', cost:0, effect:{culture:-3,people:-2}, result:{icon:'❌',title:'因循守旧',desc:'大王拒绝了新式农具，工匠失望而去。吴越错失了提升农业生产力的机会。',type:'bad'} }
    ]},
  { id:'famine_riot', tag:'urgent', tagText:'民变', title:'饥民聚众',
    scene:'杭州城外，数千饥民聚集，情绪激动，部分人已开始冲击粮仓。',
    desc:'连年灾害导致粮食短缺，数千饥民聚集城外，局势危急。大将军建议出兵镇压，丞相则主张开仓放粮安抚。',
    advisor:'cao_zhongda', advisorText:'大王，这些都是我吴越的子民，他们是因为饥饿才走投无路。臣恳请大王开仓放粮，以仁政化解危机，切不可动用武力！',
    choices:[
      { label:'【开仓放粮】', text:'立即开仓放粮，亲自出城安抚，承诺减免赋税', cost:16, effect:{people:+7,culture:+3}, result:{icon:'🌾',title:'仁君爱民',desc:'大王亲自出城，开仓放粮，饥民感激涕零，纷纷跪拜。危机化解，大王仁君之名传遍吴越。',type:'good'} },
      { label:'【恩威并施】', text:'一边放粮安抚，一边逮捕带头闹事者', cost:8, effect:{people:+3,military:+2}, result:{icon:'⚖️',title:'恩威并施',desc:'饥民得到救助，带头闹事者被逮捕，局势平息。此举虽有效，但部分百姓对逮捕行动颇有微词。',type:'neutral'} },
      { label:'【武力镇压】', text:'出兵镇压，以儆效尤', cost:3, effect:{people:-12,military:+2}, result:{icon:'💀',title:'血腥镇压',desc:'军队镇压饥民，死伤数十人。消息传开，吴越各地人心惶惶，民间开始流传反王之声。',type:'bad'} }
    ]}
];

// 特殊触发事件
const SPECIAL_EVENTS = [
  { id:'sp_people_crisis', condition:s=>s.people<=20,
    tag:'crisis', tagText:'危机', title:'民变将起',
    scene:'各地密报纷至沓来，百姓怨声载道，部分地区已出现小规模暴动。',
    desc:'民心跌至谷底，吴越各地怨声四起。若不立即采取措施，大规模民变将不可避免，吴越国祚危在旦夕。',
    advisor:'cao_zhongda', advisorText:'大王！情况万分危急！臣恳请大王立即采取措施安抚民心，否则吴越将有倾覆之危！',
    choices:[
      { label:'【紧急安抚】', text:'倾尽国库，大规模赈济，减免三年赋税，亲自巡视各地', effect:{people:+25,treasury:-30,culture:+5}, result:{icon:'🙏',title:'危机化解',desc:'大王亲力亲为，倾尽国库安抚民心。百姓感念大王诚意，民变之势逐渐平息。',type:'good'} },
      { label:'【武力镇压】', text:'出兵镇压各地暴动，以铁腕维持秩序', effect:{people:-15,military:+5,treasury:-10}, result:{icon:'💀',title:'镇压无效',desc:'武力镇压激起更大的反抗，民变愈演愈烈，吴越陷入动荡。',type:'bad'} }
    ]},
  { id:'sp_treasury_crisis', condition:s=>s.treasury<=15,
    tag:'crisis', tagText:'危机', title:'国库告罄',
    scene:'司农卿急报：国库已近枯竭，连军队的粮饷都难以为继。',
    desc:'国库空虚，军队粮饷告急，官员俸禄也难以发放。若不立即筹措资金，吴越将面临严重的财政危机。',
    advisor:'qian_weizhi', advisorText:'大王，国库已近枯竭！臣建议紧急向富商借贷，同时出售部分官职，以解燃眉之急。',
    choices:[
      { label:'【紧急筹款】', text:'向富商借贷，出售部分官职，紧急筹措资金', effect:{treasury:+25,people:-10,culture:-8}, result:{icon:'💰',title:'暂渡难关',desc:'通过借贷和卖官，暂时解决了财政危机。但此举引发争议，部分官员对卖官之举颇有微词。',type:'neutral'} },
      { label:'【紧急加税】', text:'紧急加征赋税，充实国库', effect:{treasury:+20,people:-20}, result:{icon:'😤',title:'民怨沸腾',desc:'紧急加税引发民怨，百姓苦不堪言。虽然国库暂时充盈，但民心大失。',type:'bad'} }
    ]}
];

// ===================================================
//  主动行动结果（32个行动）
// ===================================================
const ACTION_RESULTS = {
  // ===== 政务系统 =====
  exam: [
    { weight:3, result:{ icon:'🎓', title:'科举大成', desc:'此次科举人才辈出，录取了数十名优秀士子，充实了吴越的官员队伍。文治之风大盛，百姓对朝廷更加信任。', effects:{culture:+5,people:+2}, type:'good' }},
    { weight:2, result:{ icon:'📜', title:'科举顺利', desc:'科举考试顺利举行，录取了一批有才学的士子。吴越的文治水平稳步提升。', effects:{culture:+3}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'科举舞弊', desc:'科举考试中发现有人舞弊，经调查发现是某位重臣的亲属。此事引发朝野震动，文治声誉受损。', effects:{culture:-3,people:-2}, type:'bad' }}
  ],
  tour: [
    { weight:3, result:{ icon:'🚶', title:'民情大悦', desc:'大王微服私访，亲眼目睹百姓疾苦，当场下令减免赋税，百姓感激涕零。民心大振，大王仁君之名广为流传。', effects:{people:+5,culture:+3}, type:'good' }},
    { weight:2, result:{ icon:'🔍', title:'发现隐患', desc:'微服私访中发现某地官员贪腐，大王当即下令彻查。此举震慑了贪官污吏，吏治为之一清。', effects:{people:+3,culture:+4}, type:'good' }},
    { weight:1, result:{ icon:'⚠️', title:'遭遇刺客', desc:'微服私访途中遭遇刺客，幸被侍卫护驾，大王安然无恙。经查，刺客乃南唐所派。此事令朝野震动。', effects:{military:+2,diplomacy:-4,people:-3}, type:'bad' }}
  ],
  anticorr: [
    { weight:3, result:{ icon:'⚖️', title:'吏治清明', desc:'大王雷厉风行，严查贪腐，数名贪官被革职查办，赃款充入国库。朝廷风气为之一清，百姓拍手称快。', effects:{culture:+5,people:+4}, type:'good' }},
    { weight:2, result:{ icon:'📋', title:'整顿有效', desc:'整顿吏治初见成效，部分官员被警告处分，官场风气有所好转。', effects:{culture:+3,people:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'阻力重重', desc:'整顿吏治遭到部分权贵的暗中阻挠，效果有限，反而引发了朝堂内部的派系争斗。', effects:{culture:-2,people:-3,military:-2}, type:'bad' }}
  ],
  // ===== 军事系统 =====
  military: [
    { weight:3, result:{ icon:'⚔️', title:'军威大振', desc:'大王亲自检阅军队，将士们士气高昂，训练更加刻苦。军队战斗力明显提升，令周边诸国刮目相看。', effects:{military:+5,people:+2}, type:'good' }},
    { weight:2, result:{ icon:'🗡️', title:'发现问题', desc:'检阅中发现部分军队训练松弛，大王当即下令整顿。虽然短期内引起一些不满，但长远来看有利于军队建设。', effects:{military:+3,people:-1}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'军中哗变', desc:'检阅中发现军队粮饷拖欠，部分士兵情绪激动。大王紧急补发粮饷，才平息了这场风波。', effects:{military:-3,people:-3}, type:'bad' }}
  ],
  drill: [
    { weight:3, result:{ icon:'🗡️', title:'演练大成', desc:'大规模军事演练圆满成功，各军协同作战能力大幅提升。南唐探子将消息传回，南唐朝廷对吴越军力刮目相看。', effects:{military:+6,diplomacy:+2}, type:'good' }},
    { weight:2, result:{ icon:'📯', title:'演练顺利', desc:'军事演练顺利完成，将士们的战术配合更加默契，军队整体战力有所提升。', effects:{military:+4}, type:'neutral' }},
    { weight:1, result:{ icon:'💸', title:'演练事故', desc:'演练中发生意外事故，数名士兵受伤，演练被迫中止。此事令军心有所动摇。', effects:{military:-3,people:-2}, type:'bad' }}
  ],
  fortify: [
    { weight:3, result:{ icon:'🏯', title:'城防坚固', desc:'边境城池修缮一新，防御工事大为完善。南唐探子回报，吴越边境固若金汤，南唐将领望而却步。', effects:{defense:+6,people:+2}, type:'good' }},
    { weight:2, result:{ icon:'🧱', title:'工程推进', desc:'城防修缮工程稳步推进，预计明年完工。边境守军士气有所提振。', effects:{defense:+3}, type:'neutral' }},
    { weight:1, result:{ icon:'💸', title:'工程延误', desc:'城防工程因材料短缺而延误，工期大幅拖延，费用超支。', effects:{defense:-2}, type:'bad' }}
  ],
  recruit: [
    { weight:3, result:{ icon:'📯', title:'兵源充足', desc:'募兵令颁布，各地青壮踊跃应募，吴越军队规模大幅扩充。新兵经过训练，战斗力稳步提升。', effects:{military:+5,people:-1}, type:'good' }},
    { weight:2, result:{ icon:'⚔️', title:'募兵顺利', desc:'募兵工作顺利完成，军队规模有所扩大，边防力量得到加强。', effects:{military:+3}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'民怨募兵', desc:'强制募兵引发民间不满，部分百姓逃避兵役，募兵效果不佳，反而引起民怨。', effects:{military:+1,people:-5}, type:'bad' }}
  ],
  // ===== 外交系统 =====
  diplomacy: [
    { weight:2, result:{ icon:'🏮', title:'外交成功', desc:'使节出使后周，带回了后周天子的嘉奖诏书，并达成了贸易协议。吴越的外交地位大为提升。', effects:{diplomacy:+5,people:+2}, type:'good' }},
    { weight:2, result:{ icon:'🤝', title:'联络南唐', desc:'使节出使南唐，双方就边境问题达成协议，紧张局势有所缓和。两国关系趋于稳定。', effects:{diplomacy:+4,military:+2}, type:'good' }},
    { weight:1, result:{ icon:'😔', title:'外交受挫', desc:'使节出使途中遭遇意外，外交任务未能完成。此次外交失败令吴越颜面受损。', effects:{diplomacy:-4}, type:'bad' }},
    { weight:2, result:{ icon:'📜', title:'联络新罗', desc:'使节出使新罗，建立了贸易往来关系。新罗的人参、马匹将源源不断地输入吴越。', effects:{diplomacy:+3,culture:+2}, type:'good' }}
  ],
  tribute: [
    { weight:3, result:{ icon:'🎁', title:'宗主嘉许', desc:'大王遣使向后周进贡，后周天子大为满意，赐予吴越王更高封号，并承诺保护吴越不受他国侵犯。', effects:{diplomacy:+5,military:+3}, type:'good' }},
    { weight:2, result:{ icon:'🏮', title:'朝贡顺利', desc:'朝贡使团顺利抵达后周，后周天子接受贡品，两国关系维持稳定。', effects:{diplomacy:+3}, type:'neutral' }},
    { weight:1, result:{ icon:'😔', title:'朝贡受辱', desc:'后周天子对贡品不满，使者受到冷遇。此次朝贡不仅耗费了大量财物，还令吴越颜面受损。', effects:{diplomacy:-4,people:-2}, type:'bad' }}
  ],
  spy: [
    { weight:3, result:{ icon:'🕵️', title:'情报大获', desc:'密探传回重要情报：南唐正在秘密扩军，准备对吴越发动进攻。大王提前做好了防御准备，化解了危机。', effects:{military:+4,diplomacy:+2}, type:'good' }},
    { weight:2, result:{ icon:'🔍', title:'情报有用', desc:'密探传回了后周的最新动向，大王据此调整了外交策略，避免了一次外交失误。', effects:{diplomacy:+3,culture:+1}, type:'good' }},
    { weight:1, result:{ icon:'⚠️', title:'密探被捕', desc:'派往南唐的密探被捕，南唐以此为由向吴越提出抗议，外交关系趋于紧张。', effects:{diplomacy:-5,military:-2}, type:'bad' }}
  ],
  alliance: [
    { weight:2, result:{ icon:'🤝', title:'秘密同盟', desc:'大王秘密联络闽国，双方达成互不侵犯协议，并约定在南唐进攻时相互支援。吴越战略处境大为改善。', effects:{diplomacy:+5,military:+3}, type:'good' }},
    { weight:2, result:{ icon:'📜', title:'联络有成', desc:'与他国的秘密联络取得初步成果，双方建立了情报交流渠道，有助于掌握天下动向。', effects:{diplomacy:+4,military:+2}, type:'good' }},
    { weight:1, result:{ icon:'⚠️', title:'联络泄露', desc:'秘密联络的消息被南唐探子获悉，南唐向吴越提出强烈抗议，外交关系趋于紧张。', effects:{diplomacy:-5,military:-2}, type:'bad' }}
  ],
  // ===== 经济系统 =====
  trade: [
    { weight:3, result:{ icon:'⛵', title:'海贸大兴', desc:'开拓海上贸易成效显著，明州港口商船云集，来自大食、新罗、日本的商人络绎不绝。国库大为充盈。', effects:{commerce:+5,diplomacy:+3,culture:+2}, type:'good' }},
    { weight:2, result:{ icon:'💰', title:'贸易顺利', desc:'海上贸易稳步发展，国库收入有所增加。吴越的丝绸、瓷器在海外颇受欢迎。', effects:{commerce:+3,diplomacy:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'🌊', title:'商船遇难', desc:'一支商船队在海上遭遇风暴，损失惨重。此次海难令商贾们对海上贸易心存顾虑。', effects:{commerce:-4,diplomacy:-2,people:-2}, type:'bad' }}
  ],
  market: [
    { weight:3, result:{ icon:'🏪', title:'市集繁荣', desc:'各州市集兴建完毕，商贾云集，百货流通。吴越商业繁荣，国库税收大幅增加，百姓生活也更加便利。', effects:{commerce:+5,people:+3,culture:+2}, type:'good' }},
    { weight:2, result:{ icon:'💹', title:'商业发展', desc:'市集建设稳步推进，商业活动日趋活跃，国库收入有所增加。', effects:{commerce:+3,people:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'商贾纠纷', desc:'市集中发生大规模商贾纠纷，引发骚乱，部分市集被迫关闭，商业活动受到影响。', effects:{commerce:-3,people:-4}, type:'bad' }}
  ],
  tax: [
    { weight:3, result:{ icon:'📊', title:'税制改革', desc:'税制改革推行顺利，减轻了商税，整顿了田赋。四方商贾云集，国库收入反而大幅增加，百姓负担也有所减轻。', effects:{commerce:+4,people:+4,culture:+2,diplomacy:+2}, type:'good' }},
    { weight:2, result:{ icon:'⚖️', title:'调整平稳', desc:'税制小幅调整，局势平稳。虽无大的改变，但也避免了改革带来的风险。', effects:{commerce:+2,people:+1}, type:'neutral' }},
    { weight:1, result:{ icon:'💸', title:'税改受阻', desc:'税制改革遭到豪强地主的强烈抵制，改革效果大打折扣，反而引发了社会动荡。', effects:{commerce:-2,people:-5,culture:-2}, type:'bad' }}
  ],
  mint: [
    { weight:3, result:{ icon:'🪙', title:'货币统一', desc:'新铸钱币质量精良，在吴越境内广泛流通，物价趋于稳定，商业活动更加活跃，国库收入稳步增加。', effects:{commerce:+4,people:+3,culture:+2}, type:'good' }},
    { weight:2, result:{ icon:'💰', title:'铸币顺利', desc:'铸币工作顺利完成，新钱币开始流通，货币体系有所改善。', effects:{commerce:+2,people:+1}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'劣币横行', desc:'铸币过程中出现腐败，部分官员以次充好，劣质钱币流入市场，引发通货混乱，百姓怨声载道。', effects:{commerce:-3,people:-4,culture:-2}, type:'bad' }}
  ],
  // ===== 民生系统 =====
  build: [
    { weight:3, result:{ icon:'🏗️', title:'水利大成', desc:'兴修水利工程顺利完工，钱塘江沿岸的灌溉系统大为改善。农业产量提升，百姓安居乐业。', effects:{people:+4,agri:+4,culture:+2}, type:'good' }},
    { weight:2, result:{ icon:'🌊', title:'工程顺利', desc:'水利工程稳步推进，预计明年完工。百姓对朝廷的努力表示认可。', effects:{people:+2,agri:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'💸', title:'工程超支', desc:'水利工程遭遇地质问题，工程量大幅增加，费用严重超支。国库压力增大。', effects:{people:-3}, type:'bad' }}
  ],
  relief: [
    { weight:3, result:{ icon:'🌾', title:'赈济得力', desc:'大王开仓放粮，赈济灾民，受灾百姓得到及时救助。民心大振，大王仁君之名传遍吴越。', effects:{people:+6,culture:+3}, type:'good' }},
    { weight:2, result:{ icon:'🍚', title:'赈济顺利', desc:'赈济工作顺利进行，灾民得到基本救助，局势趋于稳定。', effects:{people:+4}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'赈济不力', desc:'赈济物资在发放过程中遭到官员克扣，灾民未能得到足够救助，民间怨声载道。', effects:{people:-5,culture:-3}, type:'bad' }}
  ],
  medicine: [
    { weight:3, result:{ icon:'💊', title:'医馆大兴', desc:'各地医馆相继建立，名医云集，百姓就医方便。瘟疫发生率大幅降低，百姓健康状况明显改善，民心大振。', effects:{people:+5,culture:+3}, type:'good' }},
    { weight:2, result:{ icon:'🏥', title:'医馆建立', desc:'医馆在各主要城市建立，百姓就医条件有所改善，民心稳定。', effects:{people:+3}, type:'neutral' }},
    { weight:1, result:{ icon:'💸', title:'医馆不足', desc:'医馆建设资金不足，仅在少数地方建立，效果有限，百姓对朝廷的期望落空。', effects:{people:-2}, type:'bad' }}
  ],
  school: [
    { weight:3, result:{ icon:'📚', title:'教化大兴', desc:'各州学堂相继建立，读书之风盛行。吴越文化水平大幅提升，人才辈出，百姓对朝廷的认同感大为增强。', effects:{culture:+5,people:+3}, type:'good' }},
    { weight:2, result:{ icon:'🎓', title:'学堂建立', desc:'学堂在各地建立，教化工作稳步推进，文化水平有所提升。', effects:{culture:+3,people:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'师资不足', desc:'学堂建立后，却苦于师资匮乏，教学质量低下，百姓对此颇有微词。', effects:{culture:-2,people:-2}, type:'bad' }}
  ],
  // ===== 祭祀系统 =====
  religion: [
    { weight:3, result:{ icon:'🛕', title:'佛法大兴', desc:'大王礼佛祈福，广建寺庙，百姓深受感动。民心安定，社会和谐，吴越呈现出一派太平景象。', effects:{people:+4,culture:+4}, type:'good' }},
    { weight:2, result:{ icon:'🙏', title:'祈福顺利', desc:'礼佛祈福仪式庄严肃穆，百姓纷纷参与，社会风气为之一新。', effects:{people:+3,culture:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'💸', title:'耗费过多', desc:'礼佛活动规模过大，耗费了大量国库资金，引发部分官员的批评。', effects:{culture:+1,people:-2}, type:'bad' }}
  ],
  temple: [
    { weight:3, result:{ icon:'⛩️', title:'寺庙林立', desc:'大王广建寺庙，佛法大兴。吴越成为江南佛教圣地，四方信众云集，文化声望大振，百姓心灵得到慰藉。', effects:{culture:+5,people:+4,diplomacy:+2}, type:'good' }},
    { weight:2, result:{ icon:'🛕', title:'寺庙建成', desc:'新寺庙建成，香火旺盛，百姓纷纷前往礼佛，社会风气趋于平和。', effects:{culture:+3,people:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'💸', title:'劳民伤财', desc:'大规模建寺耗费了大量人力物力，百姓苦于徭役，民间怨声渐起。', effects:{people:-4,culture:+1}, type:'bad' }}
  ],
  ritual: [
    { weight:3, result:{ icon:'🎋', title:'祭天大典', desc:'祭天大典庄严隆重，大王亲临主持，百官朝拜，万民瞻仰。此举彰显了王权的神圣，大大增强了朝廷的威信。', effects:{culture:+4,people:+3,military:+2}, type:'good' }},
    { weight:2, result:{ icon:'🌟', title:'典礼顺利', desc:'祭天典礼顺利举行，礼仪庄重，百官肃穆，朝廷威信有所提升。', effects:{culture:+3,people:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'⚠️', title:'典礼失仪', desc:'祭天典礼中发生意外，礼仪出现差错，被视为不祥之兆，民间人心惶惶。', effects:{culture:-4,people:-4}, type:'bad' }}
  ],
  poetry: [
    { weight:3, result:{ icon:'🌸', title:'文化盛事', desc:'西湖诗会盛况空前，大王亲临赋诗，佳作传颂天下。吴越文化声望大振，四方文人纷纷慕名而来。', effects:{culture:+6,diplomacy:+3,people:+3}, type:'good' }},
    { weight:2, result:{ icon:'🎋', title:'雅集成功', desc:'诗会举办成功，文人雅士尽兴而归，吴越文化氛围更加浓厚。', effects:{culture:+3,people:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'😞', title:'诗会冷清', desc:'诗会参与者寥寥，文人雅士大失所望，部分人离开吴越，文化氛围有所下降。', effects:{culture:-3,people:-2}, type:'bad' }}
  ],
  // ===== 宗室系统 =====
  clan: [
    { weight:3, result:{ icon:'🏛️', title:'宗室团结', desc:'宗室会议圆满成功，钱氏宗亲齐心协力，共商国是。宗室内部矛盾得到化解，王权更加稳固。', effects:{culture:+3,people:+2,military:+2}, type:'good' }},
    { weight:2, result:{ icon:'📜', title:'会议顺利', desc:'宗室会议顺利召开，各方意见得到充分表达，朝廷决策更加稳健。', effects:{culture:+2,people:+1}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'宗室争议', desc:'宗室会议上，各方意见分歧严重，争论激烈，未能达成共识，反而加剧了宗室内部的矛盾。', effects:{culture:-3,people:-3,military:-2}, type:'bad' }}
  ],
  appoint: [
    { weight:3, result:{ icon:'📜', title:'委任得当', desc:'大王委任钱氏宗亲担任要职，这些宗亲忠心耿耿，能力出众，各地政务大为改善，王权更加稳固。', effects:{culture:+3,military:+2,people:+2}, type:'good' }},
    { weight:2, result:{ icon:'🏛️', title:'委任顺利', desc:'宗亲委任工作顺利完成，各地政务运转正常，王权得到巩固。', effects:{culture:+2,military:+1}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'宗亲无能', desc:'委任的宗亲能力不足，在任期间政务混乱，百姓对朝廷颇有怨言，反而损害了王室声誉。', effects:{culture:-3,people:-4}, type:'bad' }}
  ],
  reward: [
    { weight:3, result:{ icon:'🎖️', title:'封赏得当', desc:'大王封赏有功宗室及臣子，受赏者感激涕零，忠心倍增。朝廷上下士气大振，人人争相效力。', effects:{military:+3,culture:+2,people:+3}, type:'good' }},
    { weight:2, result:{ icon:'🏅', title:'封赏顺利', desc:'封赏仪式顺利举行，受赏者皆大欢喜，朝廷凝聚力有所增强。', effects:{military:+2,culture:+1}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'封赏不公', desc:'封赏过程中出现不公，部分有功之臣未得应有封赏，引发朝廷内部不满，人心离散。', effects:{military:-3,culture:-3,people:-3}, type:'bad' }}
  ],
  heir: [
    { weight:3, result:{ icon:'👑', title:'储君贤明', desc:'太子在大王的悉心培育下，文武双全，深得朝野好评。王位传承有序，宗室安定，百姓对吴越的未来充满信心。', effects:{culture:+4,people:+3,military:+2}, type:'good' }},
    { weight:2, result:{ icon:'📚', title:'培育有成', desc:'太子学业进步，礼仪端庄，朝廷上下对储君的表现表示满意。', effects:{culture:+2,people:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'⚠️', title:'储君顽劣', desc:'太子顽劣不化，不思进取，令大王忧心忡忡。朝野对王位传承颇有议论，人心不稳。', effects:{culture:-3,people:-3,military:-2}, type:'bad' }}
  ],
  // ===== 后宫系统 =====
  consort: [
    { weight:2, result:{ icon:'💐', title:'联姻成功', desc:'大王纳南唐宗室女为妃，两国关系大为改善。南唐暂时放弃了对吴越的军事威胁，边境趋于平静。', effects:{diplomacy:+5,people:+2,military:+2}, type:'good' }},
    { weight:2, result:{ icon:'🌸', title:'选妃得贤', desc:'此次选妃得一贤淑才女，入宫后协助处理后宫事务，深得人心。宫廷和谐，大王精力更加充沛。', effects:{people:+3,culture:+3}, type:'good' }},
    { weight:1, result:{ icon:'😤', title:'联姻受阻', desc:'联姻计划遭到对方拒绝，此举令吴越颜面受损，外交关系略有紧张。', effects:{diplomacy:-4,people:-2}, type:'bad' }}
  ],
  banquet: [
    { weight:3, result:{ icon:'🍷', title:'宴会盛大', desc:'宫廷宴会盛况空前，大王广邀朝臣及各地官员，觥筹交错，君臣同乐。朝廷凝聚力大为增强，人心归附。', effects:{people:+4,culture:+3,military:+2}, type:'good' }},
    { weight:2, result:{ icon:'🎉', title:'宴会顺利', desc:'宫廷宴会顺利举行，宾主尽欢，朝廷气氛融洽，君臣关系有所改善。', effects:{people:+2,culture:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'💸', title:'宴会铺张', desc:'宫廷宴会过于铺张，耗费大量国库资金，引发朝野批评，认为大王不知节俭。', effects:{people:-3,culture:-2}, type:'bad' }}
  ],
  marriage: [
    { weight:3, result:{ icon:'💍', title:'联姻成功', desc:'以宗室女联姻邻国，对方欣然接受。两国关系大为改善，边境趋于平静，贸易往来也更加频繁。', effects:{diplomacy:+6,military:+3}, type:'good' }},
    { weight:2, result:{ icon:'🤝', title:'联姻顺利', desc:'联姻事宜顺利完成，两国关系有所改善，外交局势趋于稳定。', effects:{diplomacy:+4,military:+2}, type:'neutral' }},
    { weight:1, result:{ icon:'😔', title:'联姻受阻', desc:'联姻计划遭到对方拒绝，此举令吴越颜面受损，外交关系略有紧张。', effects:{diplomacy:-4,people:-2}, type:'bad' }}
  ],
  harem: [
    { weight:3, result:{ icon:'🌺', title:'后宫清明', desc:'大王整顿后宫，杜绝干政，后宫秩序井然。朝廷政务不再受后宫干扰，大王精力更加集中于国事。', effects:{culture:+4,people:+2,military:+1}, type:'good' }},
    { weight:2, result:{ icon:'💐', title:'整顿有效', desc:'后宫整顿初见成效，宫廷秩序有所改善，大王处理国事更加专注。', effects:{culture:+2,people:+1}, type:'neutral' }},
    { weight:1, result:{ icon:'😤', title:'后宫争宠', desc:'整顿后宫反而引发了妃嫔之间的争宠风波，宫廷内部矛盾激化，令大王烦恼不已。', effects:{culture:-3,people:-3}, type:'bad' }}
  ]
};

// ===================================================
//  情报库
// ===================================================
const INTEL_POOL = [
  { tag:'war', tagText:'军情', text:'后周柴荣正积极备战，意图北伐契丹，收复燕云十六州。' },
  { tag:'politics', tagText:'政情', text:'南唐李璟沉迷诗词，朝政多由权臣把持，国力有所衰退。' },
  { tag:'trade', tagText:'商情', text:'大食商人带来消息：海上丝路贸易量大增，丝绸、瓷器需求旺盛。' },
  { tag:'war', tagText:'军情', text:'闽国内乱，陈洪进与留从效争夺漳泉控制权，无暇北顾。' },
  { tag:'politics', tagText:'政情', text:'后周朝廷传来消息：柴荣正在推行改革，整顿军队，国力蒸蒸日上。' },
  { tag:'trade', tagText:'商情', text:'新罗商人抵达明州，带来了大量人参和马匹，愿意以此换取吴越丝绸。' },
  { tag:'war', tagText:'军情', text:'南唐在边境增兵，据报是为了防御后周，并非针对吴越。' },
  { tag:'politics', tagText:'政情', text:'北汉刘崇向契丹求援，意图借助契丹力量对抗后周。' },
  { tag:'trade', tagText:'商情', text:'日本遣唐使来访，对吴越的文化和商品表现出浓厚兴趣。' },
  { tag:'war', tagText:'军情', text:'后蜀孟昶沉迷享乐，军备废弛，后周有意西征。' },
  { tag:'politics', tagText:'政情', text:'南汉刘晟残暴无道，民间怨声载道，国内局势不稳。' },
  { tag:'trade', tagText:'商情', text:'杭州丝绸价格上涨，各地商贾纷纷来购，国库收入有望增加。' }
];

// ===================================================
//  工具函数
// ===================================================
function clamp(v,min=0,max=100){ return Math.max(min,Math.min(max,v)); }
function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function getStatName(k){ return {people:'民心',stability:'稳定',culture:'文治',military:'军力',defense:'城防',treasury:'国库',commerce:'商业',agri:'农业',diplomacy:'外交',prestige:'声望',population:'人口',grain:'粮储'}[k]||k; }
function getStatIcon(k){ return {people:'👥',stability:'🏛️',culture:'📜',military:'⚔️',defense:'🏯',treasury:'💰',commerce:'🏪',agri:'🌾',diplomacy:'🏮',prestige:'👑',population:'👤',grain:'🌾'}[k]||''; }
function yearStr(n){
  const s=['元','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','二十一','二十二','二十三','二十四','二十五','二十六','二十七','二十八','二十九','三十'];
  return s[n-1]||n;
}
function getOfficialById(id){
  return [...COURT_OFFICIALS,...CIVIL_OFFICIALS,...MILITARY_OFFICIALS].find(o=>o.id===id);
}
function weightedRand(arr){
  const total = arr.reduce((s,i)=>s+(i.weight||1),0);
  let r = Math.random()*total;
  for(const item of arr){ r-=(item.weight||1); if(r<=0) return item; }
  return arr[arr.length-1];
}

// ===================================================
//  从各州聚合民心/军力/城防
// ===================================================
function syncStatsFromPrefectures(){
  if(!PREFECTURES || PREFECTURES.length === 0) return;
  // 民心：各州 morale 的加权平均（按人口权重）
  let totalPop = 0, weightedMorale = 0;
  // 军力：各州 troops 总和映射到0-100（满编约100千人=100）
  let totalTroops = 0;
  // 城防：各州 defense 的加权平均（按 troops 权重）
  let totalTroopsForDef = 0, weightedDefense = 0;

  PREFECTURES.forEach(p => {
    const pop = p.population || 1;
    const morale = p.morale || 50;
    const troops = p.troops || 0;
    const defense = p.defense || 50;

    totalPop += pop;
    weightedMorale += morale * pop;

    totalTroops += troops;
    totalTroopsForDef += troops;
    weightedDefense += defense * troops;
  });

  const avgMorale = totalPop > 0 ? Math.round(weightedMorale / totalPop) : 50;
  // 军力：总兵力（千人）映射，满编约100千人对应100分
  const militaryScore = Math.min(100, Math.round(totalTroops));
  const avgDefense = totalTroopsForDef > 0 ? Math.round(weightedDefense / totalTroopsForDef) : 50;

  G.stats.people   = clamp(avgMorale);
  G.stats.military = clamp(militaryScore);
  G.stats.defense  = clamp(avgDefense);
}

// ===================================================
//  UI 更新
// ===================================================
function updateStats(changes={}){
  // 百分制指标（有进度条）
  const PCT_KEYS = ['people','stability','military','defense','treasury','commerce','agri','culture','diplomacy','prestige'];
  PCT_KEYS.forEach(k=>{
    const v = G.stats[k];
    const el = document.getElementById(`val-${k}`);
    const si = document.getElementById(`stat-${k}`);
    const ce = document.getElementById(`chg-${k}`);
    if(el) el.textContent = Math.round(v);
    if(si){
      const fill = si.querySelector('.stat-fill');
      if(fill) fill.style.setProperty('--pct', String(Math.max(0,Math.min(100,v))));
      if(el) el.style.color = v<=20?'#e74c3c':v<=40?'#e67e22':'var(--gold-light)';
    }
    if(changes[k]!==undefined && changes[k]!==0){
      const c=changes[k];
      if(ce){ ce.textContent=c>0?`+${c}`:`${c}`; ce.className=`stat-change show ${c>0?'up':'down'}`; setTimeout(()=>ce.className='stat-change',2500); }
      if(si){ si.classList.add('stat-pulse'); setTimeout(()=>si.classList.remove('stat-pulse'),400); }
    }
  });
  // 实际数值（人口/粮食）
  const popEl = document.getElementById('val-population');
  const grainEl = document.getElementById('val-grain');
  if(popEl) popEl.textContent = Math.round(G.stats.population);
  if(grainEl) grainEl.textContent = Math.round(G.stats.grain);
  const td = document.getElementById('turn-display');
  const yd = document.getElementById('year-display');
  if(td) td.textContent = yearStr(G.turn);
  if(yd) yd.textContent = yearStr(G.turn);
  updateBudgetDisplay();
  updateEnergyDisplay();
  // 国库细分显示
  const taxEl = document.getElementById('val-taxIncome');
  const savEl = document.getElementById('val-savings');
  if(taxEl) taxEl.textContent = G.taxIncome;
  if(savEl) savEl.textContent = G.savings;
}

function updateEnergyDisplay(){
  const el = document.getElementById('val-energy');
  const bar = document.getElementById('energy-bar-fill');
  if(el) el.textContent = G.energy;
  if(bar){
    bar.style.width = G.energy + '%';
    bar.style.background = G.energy > 60 ? '#2ecc71' : G.energy > 30 ? '#e67e22' : '#e74c3c';
  }
}

function updateBudgetDisplay(){
  const remaining = G.budget - G.budgetUsed;
  const el = document.getElementById('budget-remaining');
  const usedEl = document.getElementById('budget-used');
  const totalEl = document.getElementById('budget-total');
  const barEl = document.getElementById('budget-bar-fill');
  if(el) el.textContent = remaining;
  if(usedEl) usedEl.textContent = G.budgetUsed;
  if(totalEl) totalEl.textContent = G.budget;
  if(barEl){
    const pct = G.budget>0 ? Math.round((remaining/G.budget)*100) : 0;
    barEl.style.width = pct+'%';
    barEl.style.background = pct>50?'#c9a84c':pct>20?'#e67e22':'#e74c3c';
  }
}

// ===================================================
//  税收计算系统
// ===================================================
// A项：税率配置
const TAX_RATE_CONFIG = {
  low:    { label:'轻徭薄赋', mult:0.70, peopleDelta:+6,  stabilityDelta:+3,  desc:'税率极低，民心大振，但国库收入减少30%' },
  normal: { label:'正常税率', mult:1.00, peopleDelta:0,   stabilityDelta:0,   desc:'维持正常税率，收支平衡' },
  high:   { label:'加征赋税', mult:1.35, peopleDelta:-8,  stabilityDelta:-5,  desc:'税率偏高，国库充盈，但民心下滑' },
  harsh:  { label:'苛政重税', mult:1.70, peopleDelta:-18, stabilityDelta:-12, desc:'苛政猛于虎，税收暴增，但民心崩溃，随时可能民变' },
};

function calcAnnualTax(){
  // 各州税收 = 基础税 × 人口系数 × 发展度系数 × (1 - 贪腐率) × 税率乘数
  const rateCfg = TAX_RATE_CONFIG[G.taxRate] || TAX_RATE_CONFIG.normal;
  let totalTax = 0;
  const details = [];
  PREFECTURES.forEach(p=>{
    const popFactor = Math.max(0.5, p.population / 20);
    const devFactor = 0.5 + (p.development||60) / 100;
    const corrFactor = 1 - G.corruption;
    const tax = Math.round(p.tax * popFactor * devFactor * corrFactor * rateCfg.mult);
    totalTax += tax;
    details.push({ name: p.name, tax });
  });
  // 商业加成：commerce指数每10点额外+5万贯（含税率乘数）
  const commerceBonus = Math.round((G.stats.commerce - 50) / 10 * 5 * rateCfg.mult);
  // F项：商路收入
  const tradeIncome = (G.tradeRoutes||[]).filter(r=>!r.blocked).reduce((s,r)=>s+r.income,0);
  totalTax = Math.max(10, totalTax + commerceBonus + tradeIncome);
  return { total: totalTax, details, commerceBonus, tradeIncome, rateCfg };
}

function getTaxReport(){
  const r = calcAnnualTax();
  return r;
}

function addHistory(text,type='neutral'){
  G.history.push({year:G.turn,text,type});
  const log=document.getElementById('history-log');
  if(!log) return;
  const item=document.createElement('div');
  item.className=`log-item log-${type}`;
  item.innerHTML=`<span class="log-year">${yearStr(G.turn)}年</span>${text}`;
  log.insertBefore(item,log.firstChild);
  while(log.children.length>25) log.removeChild(log.lastChild);
}

function showToast(msg,type='info'){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className=`toast show ${type}`;
  setTimeout(()=>t.className='toast',2800);
}

function showConfirm(msg, title, onConfirm){
  const el = document.getElementById('confirm-overlay');
  document.getElementById('confirm-title').textContent = title||'确认';
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-ok-btn').onclick = ()=>{
    el.classList.remove('show');
    if(onConfirm) onConfirm();
  };
  document.getElementById('confirm-cancel-btn').onclick = ()=>{
    el.classList.remove('show');
  };
  el.classList.add('show');
}

// ===================================================
//  地图
// ===================================================
let mapMode = 'china';
function renderMap(){
  const c=document.getElementById('map-container');
  const btn=document.getElementById('map-mode-btn');
  if(mapMode==='china'){
    c.innerHTML=MAP_CHINA_SVG;
    btn.textContent='切换：吴越详图';
  } else {
    c.innerHTML=MAP_WUYUE_SVG;
    btn.textContent='切换：全国形势';
  }
}
function toggleMapMode(){
  mapMode = mapMode==='china'?'wuyue':'china';
  renderMap();
}

// 地图放大弹窗
let mapModalMode = 'china';
function openMapModal(){
  mapModalMode = mapMode; // 默认与当前小地图同步
  const modal = document.getElementById('map-modal');
  if(!modal) return;
  modal.classList.add('show');
  _renderMapModal();
  // 同步标签高亮
  document.getElementById('mmt-china').classList.toggle('active', mapModalMode==='china');
  document.getElementById('mmt-wuyue').classList.toggle('active', mapModalMode==='wuyue');
  // ESC 关闭
  document.addEventListener('keydown', _mapModalEsc);
}
function _mapModalEsc(e){ if(e.key==='Escape') closeMapModal(); }
function closeMapModal(){
  const modal = document.getElementById('map-modal');
  if(modal) modal.classList.remove('show');
  document.removeEventListener('keydown', _mapModalEsc);
}
function switchMapModal(mode, el){
  mapModalMode = mode;
  document.querySelectorAll('.map-modal-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  _renderMapModal();
}
function _renderMapModal(){
  const body = document.getElementById('map-modal-body');
  if(!body) return;
  body.innerHTML = mapModalMode==='china' ? MAP_CHINA_SVG : MAP_WUYUE_SVG;
}

// ===================================================
//  官员列表
// ===================================================
let currentOfficialTab = 'court';
function switchOfficialTab(tab, el){
  currentOfficialTab=tab;
  document.querySelectorAll('.official-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderOfficialList();
}

function renderOfficialList(){
  const list=document.getElementById('official-list');
  if(!list) return;
  let officials;
  if(currentOfficialTab==='court') officials=COURT_OFFICIALS;
  else if(currentOfficialTab==='civil') officials=CIVIL_OFFICIALS;
  else officials=MILITARY_OFFICIALS;

  list.innerHTML=officials.map(o=>{
    const isKing = o.id === 'qian_hongchu';
    const loyaltyColor = o.loyalty>=80?'#2ecc71':o.loyalty>=60?'#e8c97a':'#e74c3c';
    const age = o.age ? (o.age + G.turn - 1) : '?';  // 随年份增长
    const rightBlock = isKing
      ? `<div class="off-loyalty" style="color:var(--gold-light);text-align:right;line-height:1.3">
           <div style="font-size:10px;color:var(--text-muted)">${age}岁</div>
           <div style="font-size:9px;color:var(--gold)">国主</div>
         </div>`
      : `<div class="off-loyalty" style="color:${loyaltyColor};text-align:right;line-height:1.3">
           <div style="font-size:10px;color:var(--text-muted)">${age}岁</div>
           <div>忠${o.loyalty}</div>
         </div>`;
    return `<button class="official-item" onclick="openOfficialModal('${o.id}')">
      <div class="off-avatar" style="background:linear-gradient(135deg,${o.color}88,${o.color}44)">${o.emoji}</div>
      <div class="off-info">
        <div class="off-name">${o.name}</div>
        <div class="off-role">${o.role}</div>
      </div>
      ${rightBlock}
    </button>`;
  }).join('');
}

// ===================================================
//  官员详情弹窗
// ===================================================
function openOfficialModal(id){
  const o=getOfficialById(id);
  if(!o) return;
  G.selectedOfficial=o;
  document.getElementById('modal-avatar').textContent=o.emoji;
  document.getElementById('modal-avatar').style.background=`linear-gradient(135deg,${o.color}88,${o.color}44)`;
  document.getElementById('modal-name').textContent=o.name;
  document.getElementById('modal-role').textContent=o.role;
  const currentAge = o.age ? (o.age + G.turn - 1) : '不详';
  const ageEl = document.getElementById('modal-age');
  if(ageEl) ageEl.textContent = currentAge + (o.age?'岁':'');
  const isKing = o.id === 'qian_hongchu';
  const loyaltyEl = document.getElementById('modal-loyalty');
  if(loyaltyEl){
    if(isKing){
      loyaltyEl.textContent = '—';
      loyaltyEl.style.color = 'var(--text-muted)';
    } else {
      const loyaltyColor = o.loyalty>=80?'#2ecc71':o.loyalty>=60?'#e8c97a':'#e74c3c';
      loyaltyEl.textContent = o.loyalty;
      loyaltyEl.style.color = loyaltyColor;
    }
  }
  document.getElementById('modal-ability').textContent=o.ability;
  document.getElementById('modal-skill').textContent=o.skill;
  document.getElementById('modal-trait').textContent=o.trait;
  document.getElementById('modal-bio').textContent=o.bio;
  const talkBtn=document.getElementById('modal-talk-btn');
  const talkCost = 5; // 召见问政花费5万贯
  const canTalk = (G.budget - G.budgetUsed) >= talkCost;
  talkBtn.disabled=!canTalk;
  talkBtn.style.opacity=!canTalk?'0.4':'1';
  document.getElementById('official-modal').classList.add('show');
}
function closeOfficialModal(){
  document.getElementById('official-modal').classList.remove('show');
  G.selectedOfficial=null;
}

function talkToOfficial(){
  const talkCost = 5;
  if((G.budget - G.budgetUsed) < talkCost){ showToast('预算不足！召见问政需要5万贯','warn'); return; }
  const o=G.selectedOfficial;
  if(!o){ closeOfficialModal(); return; }
  closeOfficialModal();
  spendBudget(talkCost);

  // 根据官员特长给出不同效果
  const skillEffects = {
    '文治':{ effect:{culture:+8,people:+3}, desc:`${o.name}就文治之道侃侃而谈，提出了数条改善吏治的建议，大王深受启发。` },
    '军事':{ effect:{military:+8,treasury:-3}, desc:`${o.name}详细分析了当前军事形势，提出了加强边防的具体方案，大王深以为然。` },
    '财政':{ effect:{treasury:+10,people:-2}, desc:`${o.name}就国库收支提出了详细的改革方案，预计可增加收入，但需要一定时间见效。` },
    '农政':{ effect:{people:+8,treasury:+5}, desc:`${o.name}汇报了各地农业生产情况，并提出了推广新式农具的建议，大王当即批准。` },
    '外交':{ effect:{diplomacy:+10,treasury:-3}, desc:`${o.name}就当前外交形势进行了深入分析，提出了与后周、南唐周旋的具体策略。` },
    '水利':{ effect:{people:+6,treasury:-5}, desc:`${o.name}呈上了水利工程规划图，详细说明了修建方案，大王批准拨款启动。` },
    '海贸':{ effect:{treasury:+8,diplomacy:+5}, desc:`${o.name}汇报了海上贸易的最新情况，并提出了扩大贸易规模的建议。` },
    '法律':{ effect:{culture:+8,people:+5}, desc:`${o.name}就当前法律制度提出了改革建议，大王批准推行，吏治为之一清。` },
    '文学':{ effect:{culture:+10,people:+3}, desc:`${o.name}呈上了新作诗文，并就文化建设提出了建议，大王大为赞赏。` },
    '军政':{ effect:{military:+6,culture:+3}, desc:`${o.name}就军政事务进行了详细汇报，提出了改善军队管理的建议。` },
    '内政':{ effect:{people:+6,culture:+5}, desc:`${o.name}就内政事务提出了多条改善建议，大王一一批准，朝政为之一新。` },
    '步战':{ effect:{military:+8,treasury:-4}, desc:`${o.name}汇报了军队训练情况，并请求增加军费以提升战斗力，大王批准了部分请求。` },
    '水战':{ effect:{military:+8,diplomacy:+3}, desc:`${o.name}就水师建设提出了详细方案，大王批准拨款加强水师力量。` },
    '骑战':{ effect:{military:+7,treasury:-3}, desc:`${o.name}汇报了骑兵训练情况，并提出了改善马匹供应的建议。` },
    '守备':{ effect:{military:+6,people:+3}, desc:`${o.name}汇报了边境防御情况，提出了加强边境工事的建议，大王批准实施。` },
    '后勤':{ effect:{military:+4,treasury:+5}, desc:`${o.name}就军队后勤保障提出了改善方案，预计可降低军费开支同时提升保障水平。` },
    '礼仪':{ effect:{culture:+6,diplomacy:+5}, desc:`${o.name}就礼仪制度提出了改革建议，大王批准推行，朝廷礼仪更加规范。` },
    '礼制':{ effect:{culture:+8,diplomacy:+5}, desc:`${o.name}就礼制改革提出了详细方案，大王批准实施，吴越礼制更加完善。` },
    '军务':{ effect:{military:+7,culture:+3}, desc:`${o.name}就军务管理提出了改革建议，大王批准推行，军队管理更加规范。` }
  };
  const se = skillEffects[o.skill] || { effect:{culture:+5,people:+3}, desc:`${o.name}就国事进行了深入汇报，提出了多条有益建议，大王深受启发。` };

  // 忠诚度影响效果
  const loyaltyBonus = o.loyalty >= 80 ? 1.2 : o.loyalty >= 60 ? 1.0 : 0.7;
  const finalEffect = {};
  Object.entries(se.effect).forEach(([k,v])=>{ finalEffect[k]=Math.round(v*loyaltyBonus); });

  applyEffects(finalEffect);
  showResult({
    icon:'💬', title:`召见${o.name}`,
    desc: se.desc + (o.loyalty<60?`\n（注：${o.name}忠诚度较低，建议效果打折。）`:''),
    effects: finalEffect, type:'neutral'
  }, ()=>{});
}

// ===================================================
//  行动系统
// ===================================================
function switchSystem(sysId, el){
  G.currentSystem = sysId;
  document.querySelectorAll('.system-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  renderActions();
  renderSysDetail(sysId);
}

// ===================================================
//  各系统详情面板渲染
// ===================================================
function renderSysDetail(sysId){
  const panel = document.getElementById('sys-detail-panel');
  if(!panel) return;
  panel.innerHTML = '';
  if(sysId === 'junshi')    panel.innerHTML = renderMilitaryDetail();
  else if(sysId === 'waijiao') panel.innerHTML = renderDiplomacyDetail();
  else if(sysId === 'jingji')  panel.innerHTML = renderEconomyDetail();
  else if(sysId === 'zhengwu') panel.innerHTML = renderZhengwuDetail();
  else if(sysId === 'minsheng') panel.innerHTML = renderMinshengDetail();
  else panel.innerHTML = '';
}

// ── 军事详情 ──────────────────────────────────────
function renderMilitaryDetail(){
  const threatLabel = { none:'无威胁', low:'低', medium:'中', high:'高', critical:'危急', pirates:'海寇', south_tang:'南唐', min:'闽国', zhou:'后周' };
  const threatColor = { none:'#2ecc71', low:'#f39c12', medium:'#e67e22', high:'#e74c3c', critical:'#c0392b', pirates:'#7f8c8d', south_tang:'#e74c3c', min:'#e67e22', zhou:'#c9a84c' };
  const statusColor = { standby:'#7f8c8d', training:'#3498db', marching:'#f39c12', battle:'#e74c3c', rest:'#2ecc71' };
  const statusLabel = { standby:'待命', training:'训练中', marching:'行军中', battle:'作战中', rest:'休整中' };

  function bar(val, color){
    return `<div class="syd-bar-wrap"><div class="syd-bar" style="width:${val}%;background:${color}"></div><span class="syd-bar-val">${val}</span></div>`;
  }

  // 兵种构成色块
  function troopComposition(u){
    const types = [
      { key:'infantry', label:'步兵', color:'#e74c3c' },
      { key:'cavalry',  label:'骑兵', color:'#c9a84c' },
      { key:'archers',  label:'弓弩', color:'#2ecc71' },
      { key:'navy',     label:'水军', color:'#3498db' },
      { key:'engineers',label:'辎重', color:'#9b59b6' }
    ].filter(t => u[t.key] > 0);
    const bars = types.map(t =>
      `<div class="mil-troop-seg" style="width:${u[t.key]}%;background:${t.color}" title="${t.label} ${u[t.key]}%"></div>`
    ).join('');
    const labels = types.map(t =>
      `<span class="mil-troop-tag" style="border-color:${t.color};color:${t.color}">${t.label} ${u[t.key]}%</span>`
    ).join('');
    return `<div class="mil-troop-bar">${bars}</div><div class="mil-troop-tags">${labels}</div>`;
  }

  const allOfficials = [...MILITARY_OFFICIALS];

  const cards = MILITARY_UNITS.map(u => {
    const cmd  = allOfficials.find(o=>o.id===u.commander);
    const vcmd = allOfficials.find(o=>o.id===u.viceCommander);
    const cmdName  = cmd  ? `${cmd.name}（${cmd.role}）`  : '空缺';
    const vcmdName = vcmd ? `${vcmd.name}（${vcmd.role}）` : '空缺';
    const cmdAbility  = cmd  ? cmd.ability  : 0;
    const vcmdAbility = vcmd ? vcmd.ability : 0;
    const tColor = threatColor[u.threat] || '#7f8c8d';
    const tLabel = threatLabel[u.threat] || u.threat;
    const sColor = statusColor[u.status] || '#7f8c8d';
    const sLabel = statusLabel[u.status] || u.status;
    const moraleColor  = u.morale>=75?'#2ecc71':u.morale>=50?'#f39c12':'#e74c3c';
    const supplyColor  = u.supply>=70?'#2ecc71':u.supply>=40?'#f39c12':'#e74c3c';
    const combatColor  = u.combat>=75?'#2ecc71':u.combat>=50?'#f39c12':'#e74c3c';
    const grainColor   = u.grain>=70?'#2ecc71':u.grain>=40?'#f39c12':'#e74c3c';
    const equipColor   = u.equipment>=70?'#2ecc71':u.equipment>=40?'#f39c12':'#e74c3c';
    const totalBattles = u.battleRecord.wins + u.battleRecord.losses + u.battleRecord.draws;
    const winRate = totalBattles > 0 ? Math.round(u.battleRecord.wins/totalBattles*100) : 0;
    const specialtyTags = (u.specialties||[]).map(s=>`<span class="mil-specialty-tag">${s}</span>`).join('');
    const warshipsHtml = u.warships > 0
      ? `<div class="mil-resource-item"><span class="mil-res-icon">⛵</span><span class="mil-res-label">战船</span><span class="mil-res-val">${u.warships}艘</span></div>`
      : '';
    const horsesHtml = u.horses > 0
      ? `<div class="mil-resource-item"><span class="mil-res-icon">🐴</span><span class="mil-res-label">战马</span><span class="mil-res-val">${u.horses}百匹</span></div>`
      : '';

    return `<div class="mil-unit-card" style="border-left:4px solid ${u.color}">
      <!-- 卡片头部 -->
      <div class="mil-card-header">
        <div class="mil-card-title-row">
          <span class="mil-unit-emoji">${u.emoji}</span>
          <div class="mil-unit-title">
            <div class="mil-unit-name">${u.name}</div>
            <div class="mil-unit-role">${u.role}</div>
          </div>
          <div class="mil-card-badges">
            <span class="mil-status-badge" style="background:${sColor}20;color:${sColor};border-color:${sColor}40">${sLabel}</span>
            <span class="mil-threat-badge" style="color:${tColor}">⚠ ${tLabel}</span>
          </div>
        </div>
        <div class="mil-card-meta">
          <span>${u.locationEmoji} ${u.location}</span>
          <span>${u.typeEmoji} ${u.type}</span>
          <span>🏆 ${u.battleRecord.wins}胜${u.battleRecord.losses}负${u.battleRecord.draws}平（胜率${winRate}%）</span>
        </div>
      </div>

      <!-- 将领信息 -->
      <div class="mil-commanders">
        <div class="mil-cmd-row">
          <span class="mil-cmd-label">主帅</span>
          <span class="mil-cmd-name">${cmdName}</span>
          ${cmd ? `<span class="mil-cmd-ability" style="color:${cmdAbility>=80?'#2ecc71':cmdAbility>=65?'#f39c12':'#e74c3c'}">能力 ${cmdAbility}</span>` : '<span class="mil-cmd-vacant">⚠ 空缺</span>'}
        </div>
        <div class="mil-cmd-row">
          <span class="mil-cmd-label">副帅</span>
          <span class="mil-cmd-name">${vcmdName}</span>
          ${vcmd ? `<span class="mil-cmd-ability" style="color:${vcmdAbility>=80?'#2ecc71':vcmdAbility>=65?'#f39c12':'#e74c3c'}">能力 ${vcmdAbility}</span>` : '<span class="mil-cmd-vacant">⚠ 空缺</span>'}
        </div>
      </div>

      <!-- 核心数值 -->
      <div class="mil-stats-grid">
        <div class="mil-stat-block">
          <div class="mil-stat-label">兵力</div>
          <div class="mil-stat-big" style="color:#3498db">${u.troops}<span class="mil-stat-unit">千</span></div>
        </div>
        <div class="mil-stat-block">
          <div class="mil-stat-label">战力</div>
          <div class="mil-stat-big" style="color:${combatColor}">${u.combat}</div>
        </div>
        <div class="mil-stat-block">
          <div class="mil-stat-label">士气</div>
          <div class="mil-stat-big" style="color:${moraleColor}">${u.morale}</div>
        </div>
        <div class="mil-stat-block">
          <div class="mil-stat-label">训练度</div>
          <div class="mil-stat-big" style="color:#9b59b6">${u.training}</div>
        </div>
      </div>

      <!-- 粮草装备 -->
      <div class="mil-logistics">
        <div class="mil-logistics-title">⚙️ 后勤保障</div>
        <div class="mil-stat-row"><span class="mil-stat-label">粮草储备</span>${bar(u.grain,grainColor)}</div>
        <div class="mil-stat-row"><span class="mil-stat-label">装备完好</span>${bar(u.equipment,equipColor)}</div>
        <div class="mil-stat-row"><span class="mil-stat-label">物资供给</span>${bar(u.supply,supplyColor)}</div>
        <div class="mil-resources-row">
          ${horsesHtml}${warshipsHtml}
        </div>
      </div>

      <!-- 兵种构成 -->
      <div class="mil-troops-section">
        <div class="mil-logistics-title">🗺️ 兵种构成</div>
        ${troopComposition(u)}
      </div>

      <!-- 特殊能力 -->
      ${specialtyTags ? `<div class="mil-specialties">${specialtyTags}</div>` : ''}

      <!-- 简介 -->
      <div class="mil-unit-desc">${u.desc}</div>
    </div>`;
  }).join('');

  const totalTroops = MILITARY_UNITS.reduce((s,u)=>s+u.troops,0);
  const avgMorale   = Math.round(MILITARY_UNITS.reduce((s,u)=>s+u.morale,0)/MILITARY_UNITS.length);
  const avgCombat   = Math.round(MILITARY_UNITS.reduce((s,u)=>s+u.combat,0)/MILITARY_UNITS.length);
  const avgGrain    = Math.round(MILITARY_UNITS.reduce((s,u)=>s+u.grain,0)/MILITARY_UNITS.length);
  const totalWins   = MILITARY_UNITS.reduce((s,u)=>s+u.battleRecord.wins,0);
  const totalLosses = MILITARY_UNITS.reduce((s,u)=>s+u.battleRecord.losses,0);

  // 训练中的部队
  const trainingUnits = (G.trainingOrders||[]).map(o=>{
    const u = MILITARY_UNITS.find(x=>x.id===o.unitId);
    return u ? `<div class="syd-warn-item" style="color:#3498db">🏋️ <b>${u.name}</b> 训练中（剩余${o.turns}年，完成后战力+${o.combatGain}）</div>` : '';
  }).join('') || '<div class="syd-warn-none">暂无训练任务</div>';

  // 细作任务
  const activeSpy = (G.spyMissions||[]).filter(m=>m.status==='active');
  const spyHtml = activeSpy.length > 0
    ? activeSpy.map(m=>`<div class="syd-warn-item" style="color:#9b59b6">🕵️ <b>${m.missionLabel}</b> → ${m.targetName}（剩余${m.turnsLeft}年）</div>`).join('')
    : '<div class="syd-warn-none">暂无细作任务</div>';

  return `<div class="syd-section">
    <div class="syd-section-title">⚔️ 军队总览</div>
    <div class="mil-overview-grid">
      <div class="mil-ov-item"><div class="mil-ov-val">${totalTroops}<span class="mil-ov-unit">千</span></div><div class="mil-ov-key">总兵力</div></div>
      <div class="mil-ov-item"><div class="mil-ov-val">${MILITARY_UNITS.length}</div><div class="mil-ov-key">支部队</div></div>
      <div class="mil-ov-item"><div class="mil-ov-val" style="color:${avgMorale>=70?'#2ecc71':'#f39c12'}">${avgMorale}</div><div class="mil-ov-key">平均士气</div></div>
      <div class="mil-ov-item"><div class="mil-ov-val" style="color:${avgCombat>=70?'#2ecc71':'#f39c12'}">${avgCombat}</div><div class="mil-ov-key">平均战力</div></div>
      <div class="mil-ov-item"><div class="mil-ov-val" style="color:${avgGrain>=70?'#2ecc71':'#f39c12'}">${avgGrain}</div><div class="mil-ov-key">平均粮草</div></div>
      <div class="mil-ov-item"><div class="mil-ov-val">${totalWins}胜${totalLosses}负</div><div class="mil-ov-key">历史战绩</div></div>
    </div>
    <div class="syd-warn-section">
      <div class="syd-warn-title">🏋️ 训练任务 <button onclick="openTrainArmyModal()" style="font-size:10px;padding:2px 6px;margin-left:6px;background:rgba(52,152,219,0.15);border:1px solid rgba(52,152,219,0.3);border-radius:4px;color:#3498db;cursor:pointer">+ 下令训练</button></div>
      ${trainingUnits}
    </div>
    <div class="syd-warn-section">
      <div class="syd-warn-title">🕵️ 细作任务 <button onclick="openSpyModal()" style="font-size:10px;padding:2px 6px;margin-left:6px;background:rgba(155,89,182,0.15);border:1px solid rgba(155,89,182,0.3);border-radius:4px;color:#9b59b6;cursor:pointer">+ 派遣细作</button></div>
      ${spyHtml}
    </div>
    <div class="mil-unit-list">${cards}</div>
  </div>`;
}

// ── 外交详情 ──────────────────────────────────────
function renderDiplomacyDetail(){
  const threatLabel = { none:'无威胁', low:'低威胁', medium:'中等威胁', high:'高威胁', critical:'危急' };
  const threatColor = { none:'#2ecc71', low:'#f39c12', medium:'#e67e22', high:'#e74c3c', critical:'#c0392b' };
  const statusColor = { vassal:'#c9a84c', neutral:'#95a5a6', hostile:'#e74c3c', ally:'#2ecc71', self:'#3498db' };

  const cards = NATIONS.filter(n=>n.id!=='wuyue_self').map(n => {
    const relColor = n.relation>=65?'#2ecc71':n.relation>=40?'#f39c12':'#e74c3c';
    const tColor = threatColor[n.threat] || '#95a5a6';
    const tLabel = threatLabel[n.threat] || n.threat;
    const sColor = statusColor[n.status] || '#95a5a6';
    const relBar = `<div class="syd-bar-wrap"><div class="syd-bar" style="width:${n.relation}%;background:${relColor}"></div><span class="syd-bar-val">${n.relation}</span></div>`;
    return `<div class="syd-nation-card" style="border-left:3px solid ${n.color}">
      <div class="syd-nation-header">
        <span class="syd-nation-emoji">${n.emoji}</span>
        <div class="syd-nation-info">
          <div class="syd-nation-name">${n.name}</div>
          <div class="syd-nation-ruler">君主：${n.ruler}</div>
        </div>
        <div class="syd-nation-status" style="color:${sColor}">${n.statusText}</div>
      </div>
      <div class="syd-nation-rel">
        <span class="syd-stat-label">关系</span>${relBar}
      </div>
      <div class="syd-nation-threat" style="color:${tColor}">⚠ ${tLabel}</div>
      <div class="syd-nation-desc">${n.desc}</div>
    </div>`;
  }).join('');

  return `<div class="syd-section">
    <div class="syd-section-title">🏮 天下形势</div>
    <div class="syd-nation-list">${cards}</div>
  </div>`;
}

// ── 经济详情 ──────────────────────────────────────
function renderEconomyDetail(){
  const totalTax = PREFECTURES.reduce((s,p)=>s+p.tax,0);
  const totalGrain = PREFECTURES.reduce((s,p)=>s+p.grain,0);
  const totalPop = PREFECTURES.reduce((s,p)=>s+p.population,0);
  const maxTax = Math.max(...PREFECTURES.map(p=>p.tax));

  const rows = PREFECTURES.map(p => {
    const taxPct = Math.round(p.tax/maxTax*100);
    const devColor = p.development>=75?'#2ecc71':p.development>=50?'#f39c12':'#e74c3c';
    return `<div class="syd-econ-row">
      <div class="syd-econ-name">${p.emoji} ${p.name}</div>
      <div class="syd-econ-bar-wrap"><div class="syd-bar" style="width:${taxPct}%;background:#c9a84c;height:8px"></div></div>
      <div class="syd-econ-tax">${p.tax}万贯</div>
      <div class="syd-econ-grain">🌾${p.grain}</div>
      <div class="syd-econ-dev" style="color:${devColor}">${p.development}%</div>
    </div>`;
  }).join('');

  return `<div class="syd-section">
    <div class="syd-section-title">💰 经济总览</div>
    <div class="syd-summary-row">
      <div class="syd-summary-item"><div class="syd-summary-val">${totalTax}万</div><div class="syd-summary-key">年税收</div></div>
      <div class="syd-summary-item"><div class="syd-summary-val">${totalGrain}万石</div><div class="syd-summary-key">粮食储备</div></div>
      <div class="syd-summary-item"><div class="syd-summary-val">${totalPop}万</div><div class="syd-summary-key">总人口</div></div>
      <div class="syd-summary-item"><div class="syd-summary-val">${G.stats.treasury}</div><div class="syd-summary-key">国库指数</div></div>
    </div>
    <div class="syd-econ-header-row">
      <span>州郡</span><span>税收</span><span></span><span>粮食</span><span>开发</span>
    </div>
    <div class="syd-econ-list">${rows}</div>
  </div>`;
}

// ── 政务详情 ──────────────────────────────────────
function renderZhengwuDetail(){
  const allOff = [...COURT_OFFICIALS,...CIVIL_OFFICIALS,...MILITARY_OFFICIALS];
  const vacancies = (typeof OFFICE_ROSTER !== 'undefined') ? OFFICE_ROSTER.filter(r=>!r.officialId).length : 0;
  const total = (typeof OFFICE_ROSTER !== 'undefined') ? OFFICE_ROSTER.length : 0;
  const filled = total - vacancies;

  // 低忠诚度官员预警
  const lowLoyalty = allOff.filter(o=>o.loyalty<65).map(o=>
    `<div class="syd-warn-item">⚠ <b>${o.name}</b>（${o.role}）忠诚度 ${o.loyalty}，需关注</div>`
  ).join('') || '<div class="syd-warn-none">暂无忠诚度预警</div>';

  // 空缺州郡
  const vacantPref = PREFECTURES.filter(p=>!p.governor).map(p=>
    `<div class="syd-warn-item">📍 <b>${p.name}</b> 刺史空缺</div>`
  ).join('') || '<div class="syd-warn-none">各州刺史均已到任</div>';

  // A项：税率面板
  const rateCfg = TAX_RATE_CONFIG[G.taxRate] || TAX_RATE_CONFIG.normal;
  const taxRateBtns = Object.entries(TAX_RATE_CONFIG).map(([key,cfg])=>{
    const active = G.taxRate===key;
    const color = key==='low'?'#2ecc71':key==='normal'?'#c9a84c':key==='high'?'#e67e22':'#e74c3c';
    return `<button onclick="setTaxRate('${key}')" style="flex:1;padding:5px 2px;font-size:10px;border-radius:5px;border:1px solid ${active?color:'rgba(255,255,255,0.15)'};background:${active?`${color}22`:'transparent'};color:${active?color:'var(--text-muted)'};cursor:pointer;transition:all 0.2s">${cfg.label}</button>`;
  }).join('');
  const taxPreview = calcAnnualTax();

  // B项：官职空缺列表
  const vacantList = (G.vacantOffices||[]).length > 0
    ? (G.vacantOffices||[]).map(v=>`<div class="syd-warn-item">⚠ <b>${v.role}</b> 空缺${G.turn-v.since}年，${Object.entries(OFFICE_VACANCY_PENALTY[v.group]||{}).map(([k,val])=>`${getStatName(k)}${val}/年`).join('、')}</div>`).join('')
    : '<div class="syd-warn-none">暂无官职空缺</div>';

  // F项：商路状态
  const routeList = (G.tradeRoutes||[]).length > 0
    ? (G.tradeRoutes||[]).map(r=>`<div class="syd-warn-item" style="color:${r.blocked?'#e74c3c':'#2ecc71'}">${r.blocked?'🚫':'🚢'} <b>${r.name}</b>（${r.partner}）+${r.income}万贯/年 ${r.blocked?'[战争中断]':''}</div>`).join('')
    : '<div class="syd-warn-none">尚未开辟商路</div>';

  return `<div class="syd-section">
    <div class="syd-section-title">📋 政务概况</div>
    <div class="syd-summary-row">
      <div class="syd-summary-item"><div class="syd-summary-val">${filled}</div><div class="syd-summary-key">在职官员</div></div>
      <div class="syd-summary-item"><div class="syd-summary-val" style="color:${(G.vacantOffices||[]).length>0?'#e74c3c':'#2ecc71'}">${(G.vacantOffices||[]).length}</div><div class="syd-summary-key">官职空缺</div></div>
      <div class="syd-summary-item"><div class="syd-summary-val">${G.stats.stability}</div><div class="syd-summary-key">政局稳定</div></div>
      <div class="syd-summary-item"><div class="syd-summary-val">${G.stats.culture}</div><div class="syd-summary-key">文治</div></div>
    </div>

    <div class="syd-warn-section">
      <div class="syd-warn-title">📊 税率调整 <span style="font-size:10px;color:var(--text-muted)">当前：${rateCfg.label} · 预计税收${taxPreview.total}万贯</span></div>
      <div style="display:flex;gap:4px;margin:6px 0">${taxRateBtns}</div>
      <div style="font-size:10px;color:${G.taxRate==='low'||G.taxRate==='normal'?'#2ecc71':'#e74c3c'};padding:2px 0">${rateCfg.desc}</div>
    </div>

    <div class="syd-warn-section">
      <div class="syd-warn-title">🚢 商路 <button onclick="openTradeRouteModal()" style="font-size:10px;padding:2px 6px;margin-left:6px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:4px;color:#c9a84c;cursor:pointer">+ 开辟</button></div>
      ${routeList}
    </div>

    <div class="syd-warn-section">
      <div class="syd-warn-title">⚠️ 官职空缺</div>
      ${vacantList}
    </div>

    <div class="syd-warn-section">
      <div class="syd-warn-title">🔴 忠诚预警</div>
      ${lowLoyalty}
    </div>
    <div class="syd-warn-section">
      <div class="syd-warn-title">📍 空缺州郡</div>
      ${vacantPref}
    </div>

    <div class="syd-warn-section">
      <div class="syd-warn-title">📜 科举 <span style="font-size:10px;color:var(--text-muted)">距下届${3-(G.examCycle||0)}年</span></div>
      <div class="syd-warn-none">每3年自动开科，可在事件中选择投入规模提升士子质量</div>
    </div>

    <div class="syd-warn-section">
      <div class="syd-warn-title">👥 人口 <span style="font-size:10px;color:var(--text-muted)">总计${G.stats.population}万</span> <button onclick="openMigrationModal()" style="font-size:10px;padding:2px 6px;margin-left:6px;background:rgba(46,204,113,0.15);border:1px solid rgba(46,204,113,0.3);border-radius:4px;color:#2ecc71;cursor:pointer">移民实边</button></div>
      <div class="syd-warn-none">各州人口每年自然增长，可通过移民实边开发边疆</div>
    </div>

    <div class="syd-warn-section">
      <div class="syd-warn-title">👑 王室继承 <button onclick="openHeirModal()" style="font-size:10px;padding:2px 6px;margin-left:6px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:4px;color:#c9a84c;cursor:pointer">查看子嗣</button></div>
      ${(()=>{
        if(!G.heirs || G.heirs.length===0) return '<div class="syd-warn-item" style="color:#e74c3c">⚠ 大王尚无子嗣，储位悬空！</div>';
        const crown = G.heirs.find(h=>h.isCrownPrince);
        const crownText = crown ? `<div class="syd-warn-none">👑 太子：${crown.name}（${crown.age}岁，能力${crown.ability}，培养度${crown.education}）</div>` : '<div class="syd-warn-item" style="color:#f39c12">⚠ 尚未册立太子</div>';
        const otherCount = G.heirs.length - (crown?1:0);
        return crownText + (otherCount>0?`<div class="syd-warn-none" style="color:var(--text-muted)">另有${otherCount}位皇子</div>`:'');
      })()}
    </div>
  </div>`;
}

// ── 民生详情 ──────────────────────────────────────
function renderMinshengDetail(){
  const avgMorale = Math.round(PREFECTURES.reduce((s,p)=>s+p.morale,0)/PREFECTURES.length);
  const lowMorale = PREFECTURES.filter(p=>p.morale<65);
  const highMorale = PREFECTURES.filter(p=>p.morale>=80);

  const moraleRows = PREFECTURES.map(p=>{
    const c = p.morale>=75?'#2ecc71':p.morale>=55?'#f39c12':'#e74c3c';
    return `<div class="syd-econ-row">
      <div class="syd-econ-name">${p.emoji} ${p.name}</div>
      <div class="syd-econ-bar-wrap"><div class="syd-bar" style="width:${p.morale}%;background:${c};height:8px"></div></div>
      <div class="syd-econ-tax" style="color:${c}">${p.morale}</div>
      <div class="syd-econ-grain">👥${p.population}万</div>
    </div>`;
  }).join('');

  return `<div class="syd-section">
    <div class="syd-section-title">🌾 民生概况</div>
    <div class="syd-summary-row">
      <div class="syd-summary-item"><div class="syd-summary-val">${avgMorale}</div><div class="syd-summary-key">平均民心</div></div>
      <div class="syd-summary-item"><div class="syd-summary-val" style="color:#2ecc71">${highMorale.length}</div><div class="syd-summary-key">高民心州</div></div>
      <div class="syd-summary-item"><div class="syd-summary-val" style="color:#e74c3c">${lowMorale.length}</div><div class="syd-summary-key">低民心州</div></div>
      <div class="syd-summary-item"><div class="syd-summary-val">${G.stats.people}</div><div class="syd-summary-key">全国民心</div></div>
    </div>
    <div class="syd-econ-list">${moraleRows}</div>
  </div>`;
}

function renderActions(){
  const grid=document.getElementById('action-grid');
  if(!grid) return;
  const sys = SYSTEMS[G.currentSystem];
  if(!sys){ grid.innerHTML=''; return; }
  // 更新面板颜色主题
  const panel = document.querySelector('.action-panel');
  if(panel) panel.setAttribute('data-sys', G.currentSystem);

  const remaining = G.budget - G.budgetUsed;
  grid.innerHTML=sys.actions.map(a=>{
    const actualCost = a.baseCost; // 基础花费（实际花费在弹窗中选择）
    const canAfford = actualCost === 0 || remaining >= Math.round(actualCost * 0.5);
    const alreadyDone = a.oncePerYear && G.yearUsedActions.has(a.id);
    const energyNeeded = a.energyCost || 0;
    const hasEnergy = energyNeeded === 0 || G.energy >= energyNeeded;
    const disabled = !canAfford || alreadyDone || !hasEnergy;
    let costLabel;
    if(alreadyDone){
      costLabel = '<span style="color:#888">本年已执行</span>';
    } else if(!hasEnergy){
      costLabel = `<span style="color:#e74c3c">精力不足(需${energyNeeded})</span>`;
    } else if(actualCost === 0){
      costLabel = energyNeeded > 0
        ? `<span style="color:#9b59b6">耗精力${energyNeeded}</span>`
        : '<span style="color:#2ecc71">免费</span>';
    } else if(!canAfford){
      costLabel = `<span style="color:#e74c3c">需${actualCost}万贯</span>`;
    } else {
      const energyPart = energyNeeded > 0 ? ` +精力${energyNeeded}` : '';
      costLabel = `<span style="color:#c9a84c">${actualCost}万贯起${energyPart}</span>`;
    }
    return `<button class="action-btn${disabled?' disabled':''}${a.highlight?' highlight':''}${alreadyDone?' used':''}" onclick="doAction('${a.id}')" title="${a.desc}"${disabled?' disabled':''}>
      <div class="action-icon">${a.icon}</div>
      <div class="action-name">${a.name}</div>
      <div class="action-cost">${costLabel}</div>
    </button>`;
  }).join('');
}

function spendBudget(amount){
  G.budgetUsed = Math.min(G.budget, G.budgetUsed + amount);
  updateBudgetDisplay();
  renderActions();
}

function getActionName(id){
  for(const sysId in SYSTEMS){
    const a = SYSTEMS[sysId].actions.find(a=>a.id===id);
    if(a) return a.name;
  }
  return id;
}

// ===================================================
//  预算行动弹窗
// ===================================================
function doAction(id){
  // 处理政务事件——免费，直接触发
  if(id==='event'){
    const ev = pickEvent();
    if(!ev){ showToast('本年无待处理政务','info'); return; }
    renderEvent(ev);
    return;
  }

  // oncePerYear 检查
  const actionDef0 = getActionDef(id);
  if(actionDef0 && actionDef0.oncePerYear && G.yearUsedActions.has(id)){
    showToast(`"${actionDef0.name}"本年已执行过，明年再来！`, 'warn');
    return;
  }
  // 精力检查
  if(actionDef0 && actionDef0.energyCost && G.energy < actionDef0.energyCost){
    showToast(`精力不足！"${actionDef0.name}"需要 ${actionDef0.energyCost} 点精力，当前剩余 ${G.energy} 点`, 'warn');
    return;
  }

  // 宣战：特殊处理
  if(id==='declare_war'){
    if(G.war){ showToast('当前已处于战争状态！','warn'); return; }
    const actionDef = getActionDef(id);
    const baseCost = actionDef ? actionDef.baseCost : 40;
    const remaining = G.budget - G.budgetUsed;
    if(remaining < Math.round(baseCost * 0.5)){
      showToast(`预算不足！宣战至少需要${Math.round(baseCost*0.5)}万贯`, 'warn');
      return;
    }
    openBudgetActionModal(id, ()=>{
      openDeclareWarModal();
    });
    return;
  }

  // 科举特殊处理
  if(id==='exam'){
    const actionDef = getActionDef(id);
    const baseCost = actionDef ? actionDef.baseCost : 15;
    const remaining = G.budget - G.budgetUsed;
    if(remaining < Math.round(baseCost * 0.5)){
      showToast(`预算不足！开科举至少需要${Math.round(baseCost*0.5)}万贯`, 'warn');
      return;
    }
    openBudgetActionModal(id, (spent, official)=>{
      openExamModal();
    });
    return;
  }

  // 备战动员
  if(id==='prepare_war'){
    openBudgetActionModal(id, (spent, official)=>{
      doPreparWar();
    });
    return;
  }

  // 求和
  if(id==='sue_peace'){
    if(!G.war){ showToast('当前并无战事','info'); return; }
    openBudgetActionModal(id, (spent, official)=>{
      openSuePeaceModal();
    });
    return;
  }

  // 军事专属弹窗行动
  if(id==='new_army'){
    openNewArmyModal();
    return;
  }
  if(id==='appoint_cmd'){
    openAppointCmdModal();
    return;
  }
  if(id==='alloc_supply'){
    openAllocSupplyModal();
    return;
  }
  if(id==='plan_troops'){
    openPlanTroopsModal();
    return;
  }

  // 通用行动：弹出预算弹窗
  openBudgetActionModal(id, (spent, official)=>{
    _executeAction(id, spent, official);
  });
}

function getActionDef(id){
  for(const sysId in SYSTEMS){
    const a = SYSTEMS[sysId].actions.find(a=>a.id===id);
    if(a) return a;
  }
  return null;
}

// 获取适合某行动的官员列表（按技能匹配排序）
function getEligibleOfficials(id){
  const skillMap = {
    exam:'文学', tour:'内政', anticorr:'法律',
    military:'军事', drill:'军事', fortify:'军事', recruit:'军政',
    prepare_war:'军务', declare_war:'军事', sue_peace:'外交',
    diplomacy:'外交', tribute:'礼制', spy:'军务', alliance:'外交',
    trade:'财政', market:'财政', tax:'财政', mint:'财政',
    build:'农政', relief:'农政', medicine:'内政', school:'文治',
    religion:'礼制', temple:'礼制', ritual:'礼制', poetry:'文学',
    clan:'内政', appoint:'内政', reward:'礼制', heir:'文治',
    consort:'礼仪', banquet:'礼制', marriage:'外交', harem:'内政'
  };
  const pref = skillMap[id] || '';
  const all = [...COURT_OFFICIALS, ...CIVIL_OFFICIALS, ...MILITARY_OFFICIALS];
  // 过滤掉国王本人
  const eligible = all.filter(o=>o.id!=='qian_hongchu');
  // 按技能匹配+能力排序
  eligible.sort((a,b)=>{
    const aMatch = a.skill===pref?1:0;
    const bMatch = b.skill===pref?1:0;
    if(aMatch!==bMatch) return bMatch-aMatch;
    return (b.ability||70)-(a.ability||70);
  });
  return eligible.slice(0,8); // 最多显示8位
}

// 打开预算行动弹窗
function openBudgetActionModal(id, onConfirm){
  const actionDef = getActionDef(id);
  if(!actionDef){ showToast('未知行动','warn'); return; }
  const baseCost = actionDef.baseCost || 0;
  const remaining = G.budget - G.budgetUsed;

  // 如果免费行动直接执行
  if(baseCost === 0){
    onConfirm(0, null);
    return;
  }

  if(remaining < Math.round(baseCost * 0.5)){
    showToast(`预算不足！此行动至少需要${Math.round(baseCost*0.5)}万贯`, 'warn');
    return;
  }

  const officials = getEligibleOfficials(id);
  const maxSpend = Math.min(remaining, baseCost * 2); // 最多投入2倍基础花费

  // 投入比例选项
  const ratios = [
    { label:'节俭（50%）', pct:0.5, color:'#3498db' },
    { label:'适中（80%）', pct:0.8, color:'#c9a84c' },
    { label:'充足（100%）', pct:1.0, color:'#2ecc71' },
    { label:'倾力（150%）', pct:1.5, color:'#e67e22' }
  ].filter(r=> Math.round(baseCost*r.pct) <= remaining);

  // 构建弹窗HTML
  const officialOptions = officials.map(o=>`
    <div class="budget-official-item" data-id="${o.id}" onclick="selectBudgetOfficial(this,'${o.id}')">
      <div class="boff-avatar" style="background:linear-gradient(135deg,${o.color}88,${o.color}44)">${o.emoji}</div>
      <div class="boff-info">
        <div class="boff-name">${o.name}</div>
        <div class="boff-role">${o.role}</div>
      </div>
      <div class="boff-stats">
        <span class="boff-ability">能力${o.ability}</span>
        <span class="boff-loyalty" style="color:${o.loyalty>=70?'#2ecc71':'#e74c3c'}">忠诚${o.loyalty}</span>
      </div>
    </div>`).join('');

  const ratioOptions = ratios.map((r,i)=>{
    const spend = Math.round(baseCost * r.pct);
    return `<button class="budget-ratio-btn${i===1?' selected':''}" data-pct="${r.pct}" data-spend="${spend}"
      onclick="selectBudgetRatio(this,${spend})" style="border-color:${r.color}">
      <div style="color:${r.color};font-weight:700">${r.label}</div>
      <div style="font-size:13px;color:#e8c97a;margin-top:2px">${spend} 万贯</div>
    </button>`;
  }).join('');

  const defaultSpend = ratios.length>1 ? Math.round(baseCost*ratios[1].pct) : Math.round(baseCost*ratios[0].pct);

  const modal = document.getElementById('budget-action-modal');
  if(!modal) return;
  document.getElementById('bam-title').textContent = `${actionDef.icon} ${actionDef.name}`;
  document.getElementById('bam-basecost').textContent = baseCost;
  document.getElementById('bam-remaining').textContent = remaining;
  document.getElementById('bam-ratio-list').innerHTML = ratioOptions;
  document.getElementById('bam-official-list').innerHTML = officialOptions;
  document.getElementById('bam-spend-preview').textContent = defaultSpend;
  document.getElementById('bam-effect-preview').innerHTML = calcEffectPreview(id, defaultSpend, null);

  // 默认选中第二个比例
  G._bamState = { id, baseCost, spend: defaultSpend, officialId: null, onConfirm };
  // 默认选中第一位官员
  if(officials.length>0){
    const firstItem = document.querySelector('.budget-official-item');
    if(firstItem) selectBudgetOfficial(firstItem, officials[0].id);
  }

  modal.classList.add('show');
}

function selectBudgetRatio(btn, spend){
  document.querySelectorAll('.budget-ratio-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  G._bamState.spend = spend;
  document.getElementById('bam-spend-preview').textContent = spend;
  document.getElementById('bam-effect-preview').innerHTML = calcEffectPreview(
    G._bamState.id, spend, G._bamState.officialId
  );
}

function selectBudgetOfficial(el, officialId){
  document.querySelectorAll('.budget-official-item').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  G._bamState.officialId = officialId;
  document.getElementById('bam-effect-preview').innerHTML = calcEffectPreview(
    G._bamState.id, G._bamState.spend, officialId
  );
}

function calcEffectPreview(id, spend, officialId){
  const pool = ACTION_RESULTS[id];
  if(!pool) return '<span style="color:var(--text-muted)">执行后方知结果</span>';
  const actionDef = getActionDef(id);
  const baseCost = actionDef ? actionDef.baseCost : 10;
  const official = officialId ? getOfficialById(officialId) : null;

  // 只分析可能影响哪些方向，不透露具体数值
  const allKeys = new Set();
  const goodKeys = new Set(), badKeys = new Set();
  pool.forEach(item=>{
    Object.entries(item.result.effects||{}).forEach(([k,v])=>{
      allKeys.add(k);
      if(item.result.type==='good') goodKeys.add(k);
      if(item.result.type==='bad') badKeys.add(k);
    });
  });

  // 投入越多，好结果概率越高的提示
  const spendRatio = baseCost>0 ? spend/baseCost : 1;
  const spendHint = spendRatio >= 1.4 ? '投入充足，成事把握较大' :
                    spendRatio >= 0.9 ? '投入适中，结果难料' :
                    '投入有限，恐难尽如人意';

  // 官员能力提示
  const ability = official ? (official.ability||70) : 70;
  const abilityHint = ability >= 85 ? `${official.name}能力出众，可期良效` :
                      ability >= 70 ? `${official.name}尚可胜任` :
                      official ? `${official.name}能力平平，结果难测` : '尚未指定主管官员';

  // 可能涉及的方向（模糊显示）
  const dirHints = [...allKeys].map(k=>{
    const isGood = goodKeys.has(k);
    const isBad = badKeys.has(k);
    const dir = isGood && isBad ? '↕' : isGood ? '↑' : '↓';
    const cls = isGood && !isBad ? 'up' : !isGood && isBad ? 'down' : '';
    return `<span class="effect-badge ${cls}" style="opacity:0.7">${getStatIcon(k)} ${getStatName(k)} ${dir}</span>`;
  }).join('');

  const corrText = G.corruption>0.2 ? `<div style="color:#e74c3c;font-size:11px;margin-top:4px">⚠️ 吏治腐败，恐有损耗</div>` : '';
  return `
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">📜 可能涉及的方向（具体结果执行后方知）：</div>
    <div style="margin-bottom:6px">${dirHints}</div>
    <div style="font-size:11px;color:var(--gold-light);margin-bottom:3px">💡 ${spendHint}</div>
    <div style="font-size:11px;color:var(--text-dim)">👤 ${abilityHint}</div>
    ${corrText}`;
}

function confirmBudgetAction(){
  const state = G._bamState;
  if(!state) return;
  closeBudgetActionModal();
  spendBudget(state.spend);
  state.onConfirm(state.spend, state.officialId);
}

function closeBudgetActionModal(){
  const modal = document.getElementById('budget-action-modal');
  if(modal) modal.classList.remove('show');
}

// 执行通用行动（带预算和官员加成）
function _executeAction(id, spent, officialId){
  const pool = ACTION_RESULTS[id];
  if(!pool){ showToast('行动执行中...','info'); return; }

  const actionDef = getActionDef(id);
  const baseCost = actionDef ? actionDef.baseCost : 10;
  const official = officialId ? getOfficialById(officialId) : null;

  // 计算综合倍率
  const spendRatio = baseCost>0 ? spent/baseCost : 1;
  const spendMult = 0.5 + spendRatio * 0.5;
  const ability = official ? (official.ability||70) : 70;
  const abilityMult = 0.5 + ability/100;
  const corrLoss = 1 - G.corruption * 0.5;
  const totalMult = spendMult * abilityMult * corrLoss;

  // 投入越多，好结果概率越高
  const adjustedPool = pool.map(item=>{
    let w = item.weight;
    if(item.result.type==='good') w = Math.round(w * (1 + spendRatio * 0.5));
    if(item.result.type==='bad')  w = Math.max(1, Math.round(w * (1 - spendRatio * 0.3)));
    return {...item, weight:w};
  });

  const picked = weightedRand(adjustedPool);
  // 按倍率缩放效果
  const scaledEffects = {};
  Object.entries(picked.result.effects||{}).forEach(([k,v])=>{
    scaledEffects[k] = Math.round(v * totalMult);
  });

  applyEffects(scaledEffects);

  // 记录 oncePerYear 行动已执行
  if(actionDef && actionDef.oncePerYear){
    G.yearUsedActions.add(id);
  }
  // 扣除精力
  if(actionDef && actionDef.energyCost){
    G.energy = Math.max(0, G.energy - actionDef.energyCost);
    updateEnergyDisplay();
  }

  // 官员忠诚度微变
  if(official){
    official.loyalty = Math.max(10, Math.min(100, official.loyalty + (picked.result.type==='good'?2:-1)));
  }

  // 贪腐率受整顿吏治影响
  if(id==='anticorr'){
    G.corruption = Math.max(0.02, G.corruption - 0.02 * spendRatio);
  }

  const officialNote = official ? `（主管：${official.name}）` : '';
  addHistory(`${getActionName(id)}${officialNote}：${picked.result.title}（投入${spent}万贯）`, picked.result.type);
  showResult({
    icon: picked.result.icon,
    title: picked.result.title,
    desc: picked.result.desc + (official ? `\n\n主管官员：${official.name}（能力${official.ability}）` : ''),
    effects: scaledEffects,
    type: picked.result.type
  }, ()=>{ renderActions(); });
}

// ===================================================
//  事件系统
// ===================================================
function pickEvent(){
  // 先检查特殊事件
  for(const se of SPECIAL_EVENTS){
    if(se.condition(G.stats) && !G.usedEventIds.has(se.id)){
      G.usedEventIds.add(se.id);
      return se;
    }
  }
  // 从年度事件队列取
  if(G.yearEvents.length>0) return G.yearEvents.shift();
  // 随机选
  const avail = EVENTS.filter(e=>!G.usedEventIds.has(e.id));
  if(avail.length===0){ G.usedEventIds.clear(); return rand(EVENTS); }
  const ev = rand(avail);
  G.usedEventIds.add(ev.id);
  return ev;
}

function generateYearEvents(){
  // 每年开始时生成2-3个随机事件放入队列
  G.yearEvents=[];
  const avail = EVENTS.filter(e=>!G.usedEventIds.has(e.id));
  const pool = avail.length>=3?avail:EVENTS;
  const count = 2+Math.floor(Math.random()*2);
  const shuffled=[...pool].sort(()=>Math.random()-.5);
  for(let i=0;i<Math.min(count,shuffled.length);i++){
    G.yearEvents.push(shuffled[i]);
    G.usedEventIds.add(shuffled[i].id);
  }
  renderEventQueue();
}

function renderEventQueue(){
  const el=document.getElementById('event-queue');
  if(!el) return;
  if(G.yearEvents.length===0){
    el.innerHTML='<div style="padding:8px;font-size:11px;color:rgba(245,230,200,0.4);text-align:center;">暂无待处理政务</div>';
    return;
  }
  el.innerHTML=G.yearEvents.map(ev=>`
    <div class="official-item" style="cursor:default">
      <div class="off-avatar" style="background:rgba(201,168,76,0.15);font-size:14px">📋</div>
      <div class="off-info">
        <div class="off-name" style="font-size:11px">${ev.title}</div>
        <div class="off-role">${ev.tagText}</div>
      </div>
    </div>`).join('');
}

function renderEvent(ev){
  const panel=document.getElementById('content-panel');
  const tag=document.getElementById('content-tag');
  const title=document.getElementById('content-title');
  const body=document.getElementById('content-body');
  const choices=document.getElementById('choices');

  tag.textContent=ev.tagText;
  tag.className=`event-tag tag-${ev.tag}`;
  title.textContent=ev.title;

  // 找顾问（危机/战争事件可能没有advisor字段）
  const advisor=getOfficialById(ev.advisor)||COURT_OFFICIALS[0];
  const advisorBlock = ev.advisorText
    ? `<div class="advisor-box">
        <div class="advisor-ava" style="background:linear-gradient(135deg,${advisor.color}88,${advisor.color}44)">${advisor.emoji}</div>
        <div class="advisor-cont">
          <div class="advisor-name">${advisor.name} 进言：</div>
          <div class="advisor-text">${ev.advisorText}</div>
        </div>
       </div>`
    : (ev.isCrisis||ev.isWar
        ? `<div class="advisor-box" style="border-color:#e74c3c44;background:rgba(231,76,60,0.08)">
            <div class="advisor-ava" style="background:rgba(231,76,60,0.2)">${ev.isCrisis?'⚠️':'⚔️'}</div>
            <div class="advisor-cont">
              <div class="advisor-name" style="color:#e74c3c">${ev.isCrisis?'危机警报':'战事紧急'}</div>
              <div class="advisor-text">此事关系吴越存亡，大王须当机立断！</div>
            </div>
           </div>`
        : '');

  body.innerHTML=`
    <div class="event-scene">${ev.scene}</div>
    <div class="event-desc">${ev.desc||''}</div>
    ${advisorBlock}`;

  choices.innerHTML='';
  ev.choices.forEach((c,i)=>{
    const btn=document.createElement('button');
    btn.className='choice-btn';
    const ep=Object.entries(c.effect).map(([k,v])=>`${getStatIcon(k)}${v>0?'+':''}${v}`).join('  ');
    btn.innerHTML=`<div class="choice-label">${c.label}</div><div>${c.text}</div><div class="choice-effect">${ep}</div>`;
    btn.onclick=()=>makeChoice(ev,i);
    choices.appendChild(btn);
  });

  panel.classList.remove('fade-in');
  void panel.offsetWidth;
  panel.classList.add('fade-in');
  renderEventQueue();
}

function makeChoice(ev,idx){
  const c=ev.choices[idx];
  // 扣除选项花费（cost 字段，单位万贯）
  const cost = c.cost || 0;
  if(cost > 0){
    const remaining = G.budget - G.budgetUsed;
    if(remaining < cost){
      showToast(`预算不足！此选项需要 ${cost} 万贯，当前剩余 ${remaining} 万贯`, 'warn');
      return;
    }
    spendBudget(cost);
  }
  applyEffects(c.effect);
  addHistory(`${ev.title}：${c.text.substring(0,18)}...`, c.result.type);
  // 执行额外回调（如官员忠诚度变化、革职等）
  if(typeof c.onConfirm==='function') c.onConfirm();
  // 清空选项
  document.getElementById('choices').innerHTML='';
  showResult({ icon:c.result.icon, title:c.result.title, desc:c.result.desc, effects:c.effect, type:c.result.type }, ()=>{
    showIdleState();
  });
}

function showIdleState(){
  document.getElementById('content-tag').textContent='政务';
  document.getElementById('content-tag').className='event-tag tag-normal';
  document.getElementById('content-title').textContent='等待政务...';
  const remaining = G.budget - G.budgetUsed;
  const corrPct = Math.round(G.corruption*100);
  document.getElementById('content-body').innerHTML=`
    <div class="idle-state">
      <div class="idle-icon">📋</div>
      <div class="idle-title">朝堂清静</div>
      <div class="idle-desc">选择上方行动，或点击"处理政务"处理待办事件。<br>本年剩余预算：<span style="color:#c9a84c;font-weight:700">${remaining}</span> 万贯 &nbsp;|&nbsp; 贪腐率：<span style="color:${corrPct>30?'#e74c3c':'#2ecc71'}">${corrPct}%</span></div>
    </div>`;
  document.getElementById('choices').innerHTML='';
}

// ===================================================
//  效果应用 & 结果弹窗
// ===================================================
// 不受0-100限制的大数值字段
const BIG_STATS = new Set(['population','grain','treasury']);
function applyEffects(effects){
  const changes={};
  Object.entries(effects).forEach(([k,v])=>{
    if(G.stats[k]!==undefined){
      if(BIG_STATS.has(k)){
        G.stats[k]=Math.max(0, G.stats[k]+v);
      } else {
        G.stats[k]=clamp(G.stats[k]+v);
      }
      changes[k]=v;
    }
  });
  // 将 people/military/defense 的变化同步到各州
  if(effects.people !== undefined){
    const delta = effects.people;
    PREFECTURES.forEach(p=>{ p.morale = clamp((p.morale||50) + delta); });
  }
  if(effects.military !== undefined){
    const delta = effects.military;
    // 军力变化按比例分配到各州驻军
    PREFECTURES.forEach(p=>{ p.troops = Math.max(0, (p.troops||0) + delta * 0.1); });
  }
  if(effects.defense !== undefined){
    const delta = effects.defense;
    PREFECTURES.forEach(p=>{ p.defense = clamp((p.defense||50) + delta); });
  }
  // 从各州重新聚合 people/military/defense
  syncStatsFromPrefectures();
  updateStats(changes);
  // 随机微调官员忠诚度
  const allOff=[...COURT_OFFICIALS,...CIVIL_OFFICIALS,...MILITARY_OFFICIALS];
  allOff.forEach(o=>{ o.loyalty=clamp(o.loyalty+Math.floor(Math.random()*5)-2,10,100); });
}

function showResult(res, callback){
  document.getElementById('result-icon').textContent=res.icon;
  document.getElementById('result-title').textContent=res.title;
  document.getElementById('result-desc').textContent=res.desc;
  const ef=document.getElementById('result-effects');
  ef.innerHTML=Object.entries(res.effects||{}).map(([k,v])=>{
    const cls=v>0?'up':'down';
    return `<span class="effect-badge ${cls}">${getStatIcon(k)} ${getStatName(k)} ${v>0?'+':''}${v}</span>`;
  }).join('');
  const btn=document.getElementById('result-next-btn');
  btn.textContent='继续';
  G.pendingResultCallback=callback||null;
  document.getElementById('result-overlay').classList.add('show');
}

function closeResult(){
  document.getElementById('result-overlay').classList.remove('show');
  if(G.pendingResultCallback){ G.pendingResultCallback(); G.pendingResultCallback=null; }
  if(checkGameOver()) return;
}

// ===================================================
//  年度结算
// ===================================================
function endYear(){
  openAnnualMeetingModal();
}

// ===================================================
//  年度会议系统
// ===================================================

// 臣子提案库（每年随机抽取3-4条，玩家可选择采纳）
const MINISTER_PROPOSALS = [
  // 军事类
  { id:'mp_recruit_elite', category:'军事', icon:'⚔️', minister:'张延威', role:'兵部尚书',
    title:'精兵简政', cost:20,
    desc:'臣以为，与其广募乌合之众，不如精选精兵。建议裁减老弱，重金招募精壮，可使军队战力大增。',
    effect:{military:+4, people:-1}, risk:'裁军可能引发部分士兵不满' },
  { id:'mp_fortify_border', category:'军事', icon:'🏯', minister:'孙承祐', role:'镇海节度使',
    title:'加固西境防线', cost:25,
    desc:'南唐近来动作频频，臣请拨款加固湖州一线城防，增设烽火台，以防不测。',
    effect:{defense:+5, diplomacy:-1}, risk:'此举或令南唐误判为挑衅' },
  { id:'mp_navy_expand', category:'军事', icon:'⛵', minister:'陈承昭', role:'水师都指挥使',
    title:'扩充水师', cost:30,
    desc:'东海海寇日益猖獗，明州商路受阻。臣请增造战船十艘，扩充水师规模，保护海上贸易。',
    effect:{military:+3, commerce:+2}, risk:'造船耗资巨大，需确保国库充裕' },
  // 经济类
  { id:'mp_tax_reform', category:'经济', icon:'📊', minister:'钱惟治', role:'两浙转运使',
    title:'减免农税', cost:0,
    desc:'今年各州农业丰收，臣建议减免部分田赋，以示皇恩，可大幅提振民心，长远来看有利于人口增长。',
    effect:{people:+5, agri:+2}, risk:'短期税收减少，需从存款中补足' },
  { id:'mp_sea_trade', category:'经济', icon:'⛵', minister:'黄晟', role:'明州刺史',
    title:'开辟新航线', cost:18,
    desc:'臣在明州多年，与海外商人往来颇多。建议拨款资助商队，开辟至日本、高丽的新航线，可大增商税。',
    effect:{commerce:+4, diplomacy:+2}, risk:'海上风险难测，商队或有损失' },
  { id:'mp_market_reform', category:'经济', icon:'🏪', minister:'曹忠达', role:'丞相',
    title:'整顿市场秩序', cost:8,
    desc:'近来各地市集纠纷频发，商贾怨声载道。臣建议颁布市场法令，统一度量衡，整顿商业秩序。',
    effect:{commerce:+3, stability:+2}, risk:'部分商贾可能抵制新法令' },
  // 民生类
  { id:'mp_irrigation', category:'民生', icon:'🌊', minister:'吴程义', role:'司农卿',
    title:'兴修钱塘江堤', cost:22,
    desc:'钱塘江堤年久失修，每逢汛期百姓苦不堪言。臣请拨款修缮，可保数十万百姓安居。',
    effect:{people:+4, agri:+3}, risk:'工程浩大，若遇天灾可能延误' },
  { id:'mp_famine_relief', category:'民生', icon:'🌾', minister:'吴程义', role:'司农卿',
    title:'预备仓储粮', cost:15,
    desc:'臣建议在各州设立预备仓，丰年收购余粮，荒年平价出售，可有效防范饥荒。',
    effect:{people:+3, stability:+3}, risk:'需占用大量国库资金' },
  { id:'mp_medicine_network', category:'民生', icon:'💊', minister:'林德元', role:'翰林学士',
    title:'广设惠民药局', cost:12,
    desc:'臣建议在各州设立官办药局，低价售药，可大幅降低疫病死亡率，百姓必感恩戴德。',
    effect:{people:+4, culture:+1}, risk:'需长期投入，短期效果不显' },
  // 文化类
  { id:'mp_confucian', category:'文化', icon:'📚', minister:'徐铉', role:'翰林学士承旨',
    title:'兴办官学', cost:16,
    desc:'臣以为，文治乃立国之本。建议在各州兴办官学，延请名师，培育人才，可使吴越文风大盛。',
    effect:{culture:+5, people:+2}, risk:'师资难觅，效果需数年方显' },
  { id:'mp_history', category:'文化', icon:'📜', minister:'林德元', role:'翰林学士',
    title:'编修吴越国史', cost:10,
    desc:'臣请拨款编修吴越国史，记录钱氏功业，可彰显王室正统，提升吴越声望。',
    effect:{culture:+4, prestige:+3}, risk:'耗时数年，短期无明显效益' },
  // 外交类
  { id:'mp_zhou_tribute', category:'外交', icon:'🎁', minister:'方邵', role:'礼部尚书',
    title:'加厚朝贡礼品', cost:20,
    desc:'后周柴荣雄才大略，臣建议今年加厚朝贡礼品，以示诚意，可换取后周对吴越更多庇护。',
    effect:{diplomacy:+5, prestige:+2}, risk:'耗资较多，且可能被视为软弱' },
  { id:'mp_nantang_envoy', category:'外交', icon:'🤝', minister:'沈崇义', role:'枢密使',
    title:'遣使南唐修好', cost:12,
    desc:'臣以为，与南唐长期对峙耗损国力。建议遣使修好，暂缓边境紧张，为内政建设争取时间。',
    effect:{diplomacy:+4, military:-1}, risk:'南唐或借机提出苛刻条件' },
  // 宗室类
  { id:'mp_clan_feast', category:'宗室', icon:'🏛️', minister:'钱仁谦', role:'内枢密使',
    title:'大王宴请宗室', cost:10,
    desc:'近来宗室中有些许议论，臣建议大王设宴款待宗亲，赏赐有功之人，可稳固宗室人心。',
    effect:{people:+2, stability:+3}, risk:'若赏赐不公，反生嫌隙' },
  { id:'mp_appoint_clan', category:'宗室', icon:'📜', minister:'钱弘佐', role:'宗正卿',
    title:'委任宗亲守边', cost:8,
    desc:'臣建议委任忠诚可靠的宗亲担任边境要职，既可加强边防，又可安抚宗室。',
    effect:{military:+2, stability:+2}, risk:'宗亲能力参差不齐，或有失职' },
];

// 生成本年臣子提案（随机抽取3-4条，考虑当前局势）
function generateMinisterProposals(){
  const s = G.stats;
  // 根据当前局势加权
  const weighted = MINISTER_PROPOSALS.map(p => {
    let w = 1;
    if(p.category==='军事' && (s.military<50 || s.defense<50)) w = 2.5;
    if(p.category==='经济' && s.commerce<45) w = 2;
    if(p.category==='民生' && s.people<55) w = 2.5;
    if(p.category==='文化' && s.culture<50) w = 1.5;
    if(p.category==='外交' && s.diplomacy<45) w = 2;
    if(p.category==='宗室' && s.stability<55) w = 2;
    return { ...p, _w: w };
  });
  // 加权随机抽取4条（不重复）
  const picked = [];
  const pool = [...weighted];
  const count = Math.min(4, pool.length);
  for(let i=0;i<count;i++){
    const total = pool.reduce((s,p)=>s+p._w, 0);
    let r = Math.random()*total;
    for(let j=0;j<pool.length;j++){
      r -= pool[j]._w;
      if(r<=0){
        picked.push(pool[j]);
        pool.splice(j,1);
        break;
      }
    }
  }
  return picked;
}

// 固定支出项目（每年必须支付）
const FIXED_EXPENSES = [
  { id:'salary',   name:'官员俸禄',   icon:'📜', baseCost: 15, desc:'朝廷官员的年度俸禄，不可削减' },
  { id:'garrison', name:'驻军粮饷',   icon:'⚔️', baseCost: 20, desc:'各州驻军的粮饷，维持军队战斗力' },
  { id:'maintain', name:'宫廷维护',   icon:'🏛️', baseCost: 8,  desc:'王宫及官署的日常维护费用' },
  { id:'tribute',  name:'朝贡中原',   icon:'🎁', baseCost: 10, desc:'向后周进贡，维系宗主关系（可选）', optional:true },
];

// 自由预算分配方向
const BUDGET_ALLOC_OPTIONS = [
  { id:'military_alloc', name:'军事建设', icon:'⚔️', desc:'增强军力与城防', effect:{military:+3, defense:+2} },
  { id:'people_alloc',   name:'民生改善', icon:'👥', desc:'提升民心与农业', effect:{people:+3, agri:+2} },
  { id:'culture_alloc',  name:'文化教育', icon:'📚', desc:'提升文治与外交', effect:{culture:+3, diplomacy:+2} },
  { id:'commerce_alloc', name:'商业发展', icon:'🏪', desc:'提升商业与稳定', effect:{commerce:+3, stability:+2} },
  { id:'reserve',        name:'存入国库', icon:'🏦', desc:'结余存入历年存款', effect:{} },
];

function openAnnualMeetingModal(){
  const modal = document.getElementById('annual-meeting-modal');
  if(!modal) { _doEndYear(); return; }

  const taxReport = calcAnnualTax();
  const nextTax = taxReport.total;
  const remaining = G.budget - G.budgetUsed;
  const surplus = Math.round(remaining * 0.5);

  // 计算固定支出总额
  let fixedTotal = 0;
  FIXED_EXPENSES.forEach(e => { if(!e.optional) fixedTotal += e.baseCost; });
  const optionalTribute = FIXED_EXPENSES.find(e=>e.id==='tribute');
  const freeBudget = Math.max(0, nextTax - fixedTotal);

  // 生成本年臣子提案
  const proposals = generateMinisterProposals();
  modal._proposals = proposals;

  const catColor = { '军事':'#e74c3c','经济':'#2ecc71','民生':'#f39c12','文化':'#9b59b6','外交':'#3498db','宗室':'#1abc9c' };

  const proposalHTML = proposals.map((p,i) => {
    const cc = catColor[p.category] || '#c9a84c';
    const effText = Object.entries(p.effect).map(([k,v])=>`${getStatName(k)}${v>0?'+':''}${v}`).join('、');
    const canAfford = (G.savings + surplus) >= p.cost || p.cost === 0;
    return `
    <div class="mp-card" id="mp-card-${i}" onclick="toggleProposal(${i},this)" style="border-left:3px solid ${cc};opacity:${canAfford?1:0.5}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        <input type="checkbox" id="mp-chk-${i}" ${canAfford?'':'disabled'} style="cursor:pointer;flex-shrink:0">
        <span style="font-size:13px">${p.icon}</span>
        <div style="flex:1">
          <span style="font-size:12px;font-weight:700;color:var(--gold-light)">${p.title}</span>
          <span style="font-size:10px;color:${cc};margin-left:6px;padding:1px 5px;border-radius:8px;border:1px solid ${cc}44;background:${cc}11">${p.category}</span>
        </div>
        <span style="font-size:11px;color:#e74c3c;flex-shrink:0">${p.cost>0?`-${p.cost}万贯`:'无需花费'}</span>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;padding-left:20px">
        <span style="color:var(--text-muted)">【${p.minister}·${p.role}】</span> ${p.desc}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-left:20px">
        <span style="font-size:10px;color:#2ecc71">预期：${effText}</span>
        <span style="font-size:10px;color:#e67e22">风险：${p.risk}</span>
      </div>
    </div>`;
  }).join('');

  const body = document.getElementById('annual-meeting-body');
  body.innerHTML = `
    <div style="margin-bottom:12px;padding:10px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:6px">
      <div style="font-size:13px;color:var(--gold-light);font-weight:700;margin-bottom:6px">📊 年度财政报告</div>
      <div style="font-size:12px;color:var(--text-dim);line-height:1.8">
        本年税收：<span style="color:var(--gold-light)">${nextTax} 万贯</span> &nbsp;|&nbsp;
        本年结余：<span style="color:#2ecc71">${surplus} 万贯</span>（转入存款）<br>
        历年存款：<span style="color:#2ecc71">${G.savings + surplus} 万贯</span>
        &nbsp;|&nbsp; 固定支出：<span style="color:#e74c3c">${fixedTotal} 万贯</span>
      </div>
    </div>

    <div style="margin-bottom:12px">
      <div style="font-size:12px;color:var(--gold);font-weight:700;margin-bottom:6px">🔒 固定支出（${fixedTotal}万贯）</div>
      ${FIXED_EXPENSES.filter(e=>!e.optional).map(e=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:rgba(0,0,0,0.2);border-radius:4px;margin-bottom:4px;font-size:12px">
          <span>${e.icon} ${e.name}</span>
          <span style="color:#e74c3c">-${e.baseCost} 万贯</span>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:rgba(0,0,0,0.2);border-radius:4px;margin-bottom:4px;font-size:12px">
        <span>🎁 朝贡中原（可选）</span>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
          <input type="checkbox" id="tribute-check" style="cursor:pointer"> 支付 ${optionalTribute.baseCost} 万贯（外交+3）
        </label>
      </div>
    </div>

    <div style="margin-bottom:12px">
      <div style="font-size:12px;color:var(--gold);font-weight:700;margin-bottom:8px">💬 群臣奏议（可选择采纳，费用从存款中扣除）</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">以下为本年大臣提案，大王可酌情采纳。采纳后立即生效，费用从历年存款中扣除。</div>
      <div id="mp-list">${proposalHTML}</div>
    </div>

    <div style="margin-bottom:12px">
      <div style="font-size:12px;color:var(--gold);font-weight:700;margin-bottom:6px">🎯 自由预算分配（约 <span id="free-budget-display">${freeBudget}</span> 万贯可用）</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">选择本年重点投入方向（可多选，每项消耗约 ${Math.round(freeBudget/3)} 万贯）：</div>
      ${BUDGET_ALLOC_OPTIONS.map(o=>`
        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(0,0,0,0.2);border-radius:4px;margin-bottom:4px;font-size:12px;cursor:pointer" onclick="toggleAllocOption('${o.id}',this)" id="alloc-${o.id}">
          <input type="checkbox" id="chk-${o.id}" style="cursor:pointer" onchange="updateFreeBudgetDisplay()">
          <span>${o.icon} <strong>${o.name}</strong> — ${o.desc}</span>
          <span style="margin-left:auto;color:var(--gold-light)">${Object.entries(o.effect).map(([k,v])=>`${getStatName(k)}${v>0?'+':''}${v}`).join(' ')}</span>
        </div>`).join('')}
    </div>

    <div style="font-size:11px;color:var(--text-muted);padding:8px;background:rgba(0,0,0,0.15);border-radius:4px">
      💡 提示：未分配的自由预算将自动存入历年存款。各项行动仍需在年内手动执行。
    </div>
  `;

  // 存储下一年税收供确认时使用
  modal._nextTax = nextTax;
  modal._surplus = surplus;
  modal._fixedTotal = fixedTotal;
  modal._freeBudget = freeBudget;

  modal.style.display = 'flex';
}

function toggleProposal(i, el){
  const chk = document.getElementById('mp-chk-'+i);
  if(chk && !chk.disabled){ chk.checked = !chk.checked; }
  el.style.background = chk && chk.checked ? 'rgba(201,168,76,0.08)' : '';
}

function toggleAllocOption(id, el){
  const chk = document.getElementById('chk-'+id);
  if(chk){ chk.checked = !chk.checked; }
  updateFreeBudgetDisplay();
}

function updateFreeBudgetDisplay(){
  const modal = document.getElementById('annual-meeting-modal');
  if(!modal) return;
  const tributeCheck = document.getElementById('tribute-check');
  const tributeCost = tributeCheck && tributeCheck.checked ? 10 : 0;
  const checkedCount = BUDGET_ALLOC_OPTIONS.filter(o=>{
    const chk = document.getElementById('chk-'+o.id);
    return chk && chk.checked;
  }).length;
  const perOption = modal._freeBudget > 0 ? Math.round(modal._freeBudget / Math.max(1, checkedCount || 1)) : 0;
  const freeEl = document.getElementById('free-budget-display');
  if(freeEl) freeEl.textContent = Math.max(0, modal._freeBudget - tributeCost);
}

function confirmAnnualMeeting(){
  const modal = document.getElementById('annual-meeting-modal');
  if(!modal) return;
  modal.style.display = 'none';

  // 处理可选朝贡
  const tributeCheck = document.getElementById('tribute-check');
  const doTribute = tributeCheck && tributeCheck.checked;
  if(doTribute){
    applyEffects({diplomacy:+3});
    addHistory('年度朝贡：向后周进贡，外交关系改善', 'good');
  }

  // 处理臣子提案（采纳的从存款中扣除）
  const proposals = modal._proposals || [];
  proposals.forEach((p, i) => {
    const chk = document.getElementById('mp-chk-'+i);
    if(chk && chk.checked){
      // 扣除存款
      if(p.cost > 0){
        G.savings = Math.max(0, G.savings - p.cost);
      }
      // 应用效果
      applyEffects(p.effect);
      addHistory(`采纳提案「${p.title}」（${p.minister}建议）：${Object.entries(p.effect).map(([k,v])=>`${getStatName(k)}${v>0?'+':''}${v}`).join('、')}`, 'good');
    }
  });

  // 处理自由预算分配
  const checkedOptions = BUDGET_ALLOC_OPTIONS.filter(o=>{
    const chk = document.getElementById('chk-'+o.id);
    return chk && chk.checked && Object.keys(o.effect).length > 0;
  });
  if(checkedOptions.length > 0){
    checkedOptions.forEach(o=>{
      applyEffects(o.effect);
      addHistory(`年度预算分配：${o.name}，${Object.entries(o.effect).map(([k,v])=>`${getStatName(k)}${v>0?'+':''}${v}`).join('、')}`, 'good');
    });
  }

  // 执行年度结算
  _doEndYear();
}

function _doEndYear(){
  // ── 税收结算 ──
  const taxReport = calcAnnualTax();
  const newTax = taxReport.total;
  // 未用完的预算结余转入存款（最多保留50%）
  const surplus = Math.round((G.budget - G.budgetUsed) * 0.5);
  G.savings = Math.max(0, G.savings + surplus);
  G.taxIncome = newTax;
  // 国库综合指数 = 存款/10（上限100）
  G.stats.treasury = Math.min(100, Math.round(G.savings / 10));

  // 贪腐自然增长（每年+0.5%，受稳定度抑制）
  const corrGrowth = 0.005 * (1 - G.stats.stability/200);
  G.corruption = Math.min(0.6, G.corruption + corrGrowth);

  // ── 年度自然变化 ──
  const s = G.stats;
  const popGrowth = Math.round(s.population * 0.008 * (s.people/100) * (0.8 + Math.random()*0.4));
  const grainConsume = Math.round(s.population * 0.15 * (1.2 - s.agri/200));
  const grainProduce = Math.round(s.population * 0.18 * (s.agri/100) * (0.9 + Math.random()*0.2));
  const naturalChange={
    people:     Math.floor(Math.random()*4)-1,
    stability:  Math.floor(Math.random()*3)-1,
    military:   Math.floor(Math.random()*3)-1,
    commerce:   Math.floor(Math.random()*3)-1,
    agri:       Math.floor(Math.random()*3)-1,
    diplomacy:  Math.floor(Math.random()*3)-2,
    population: popGrowth,
    grain:      grainProduce - grainConsume,
  };
  applyEffects(naturalChange);
  const grainNet = grainProduce - grainConsume;
  const grainDesc = grainNet>=0 ? `粮食净增${grainNet}万石` : `粮食净减${Math.abs(grainNet)}万石`;
  const corrPct = Math.round(G.corruption*100);
  // ── A项：税率对民心/稳定的年度影响 ──
  const rateCfg = TAX_RATE_CONFIG[G.taxRate] || TAX_RATE_CONFIG.normal;
  if(rateCfg.peopleDelta !== 0){
    applyEffects({ people: rateCfg.peopleDelta, stability: rateCfg.stabilityDelta });
  }
  // 苛政重税：民心<30时有50%概率触发民变事件
  if(G.taxRate === 'harsh' && G.stats.people < 30 && Math.random() < 0.5){
    _triggerRebellionEvent();
  }
  // 高税率：民心<40时有25%概率触发民变
  if(G.taxRate === 'high' && G.stats.people < 40 && Math.random() < 0.25){
    _triggerRebellionEvent();
  }

  // ── B项：官职空缺惩罚（每个空缺每年扣对应指标）──
  (G.vacantOffices||[]).forEach(v=>{
    const penalty = OFFICE_VACANCY_PENALTY[v.group] || {};
    applyEffects(penalty);
    addHistory(`⚠️ ${v.role}一职空缺已${G.turn - v.since}年，${Object.entries(penalty).map(([k,val])=>`${getStatName(k)}${val}`).join('、')}。`, 'bad');
  });

  // ── F项：商路收入日志 ──
  const activeRoutes = (G.tradeRoutes||[]).filter(r=>!r.blocked);
  if(activeRoutes.length > 0){
    const tradeTotal = activeRoutes.reduce((s,r)=>s+r.income,0);
    addHistory(`🚢 商路收入：${activeRoutes.map(r=>r.name).join('、')}，合计${tradeTotal}万贯已计入税收。`, 'good');
    // 商路每年增加commerce
    applyEffects({ commerce: activeRoutes.length });
    // 商路活跃年数+1
    activeRoutes.forEach(r=>r.turnsActive = (r.turnsActive||0)+1);
  }
  // 战争期间商路中断
  if(G.war){
    (G.tradeRoutes||[]).forEach(r=>{
      if(!r.blocked){ r.blocked = true; addHistory(`⚔️ 战争期间，${r.name}商路中断！`, 'bad'); }
    });
  } else {
    // 和平时期恢复商路
    (G.tradeRoutes||[]).filter(r=>r.blocked).forEach(r=>{
      r.blocked = false;
      addHistory(`✅ ${r.name}商路已恢复通畅。`, 'good');
    });
  }

  const taxRateLabel = rateCfg.label;
  const tradeIncome = taxReport.tradeIncome || 0;
  const tradeDesc = tradeIncome > 0 ? `，商路收入${tradeIncome}万贯` : '';
  addHistory(`第${yearStr(G.turn)}年结束。税收${newTax}万贯（${taxRateLabel}${tradeDesc}），结余${surplus}万贯入库，贪腐率${corrPct}%。人口增加${popGrowth}万，${grainDesc}。`,'neutral');

  // 战争年度消耗
  warYearEndCheck();

  // 随机情报更新
  updateIntel();

  G.turn++;
  if(checkGameOver()) return;

  // ── 新年初始化 ──
  G.budget = newTax;
  G.budgetUsed = 0;
  G.energy = 100;           // 精力每年重置为100
  G.yearUsedActions = new Set(); // 每年行动记录清空
  updateEnergyDisplay();
  generateYearEvents();

  // 检查危机事件（插入队列最前）
  checkCrisisEvents();
  // 检查年度特殊事件（追加到队列）
  checkAnnualSpecialEvents();
  // 检查官员忠诚度危机
  checkOfficialLoyalty();

  // 官员自然老化（每年+1岁，高龄官员可能退休/病死）
  const allOff=[...COURT_OFFICIALS,...CIVIL_OFFICIALS,...MILITARY_OFFICIALS];
  allOff.forEach(o=>{
    if(o.id==='qian_hongchu') return;
    o.age = (o.age||40)+1;
    const loyaltyDrift = Math.floor(Math.random()*5)-2 + (G.stats.stability>60?1:-1);
    o.loyalty = Math.max(10, Math.min(100, (o.loyalty||70)+loyaltyDrift));
    // B项：高龄致仕或病死，记录空缺
    let departed = false;
    if(o.age>=70 && Math.random()<0.3){
      addHistory(`${o.name}年迈致仕，告老还乡。`, 'neutral');
      departed = true;
    } else if(o.age>=50 && Math.random()<0.04){
      addHistory(`${o.name}积劳成疾，不幸病逝，享年${o.age}岁。`, 'bad');
      departed = true;
    }
    if(departed){
      const group = COURT_OFFICIALS.find(x=>x.id===o.id)?'court':CIVIL_OFFICIALS.find(x=>x.id===o.id)?'civil':'military';
      _recordVacancy(o.id, o.role, group);
      removeOfficial(o.id);
    }
  });

  // E项：年度灾害检查
  _checkAnnualDisaster();
  // D项：邻国使者生成
  _generateEnvoyEvents();
  // 新A项：科举周期检查（每3年自动触发）
  _checkExamCycle();
  // 新B项：各州人口自然增长
  _doPopulationGrowth();
  // 新C项：军队训练进度推进
  _advanceTrainingOrders();
  // 新D项：细作任务结算
  _resolveSpyMissions();
  // 新E项：子嗣成长与储位检查
  _doHeirGrowth();
  // 重置本年移民标记
  G.migrationDone = false;

  updateStats();
  renderActions();
  renderEventQueue();
  showIdleState();
  showToast(`第${yearStr(G.turn)}年开始！本年税收 ${newTax} 万贯，贪腐率 ${corrPct}%`, 'info');
  // 每年结束自动存档
  autoSave();
}

function updateIntel(){
  const newIntel=rand(INTEL_POOL);
  G.intel.unshift(newIntel);
  if(G.intel.length>6) G.intel.pop();
  renderIntel();
}

function renderIntel(){
  const el=document.getElementById('intel-list');
  if(!el) return;
  if(G.intel.length===0){
    el.innerHTML='<div style="padding:8px;font-size:11px;color:rgba(245,230,200,0.4);text-align:center;">暂无情报</div>';
    return;
  }
  el.innerHTML=G.intel.map(i=>`
    <div class="intel-item">
      <span class="intel-tag it-${i.tag}">${i.tagText}</span>${i.text}
    </div>`).join('');
}

// ===================================================
//  游戏结束
// ===================================================
const END_CONDITIONS=[
  { check:s=>s.people<=0, icon:'💀', title:'民变亡国', subtitle:'吴越国在民变中覆灭', desc:'民心尽失，吴越各地烽烟四起。大王在民变中失去了一切，吴越国就此覆灭，史书将你记为亡国之君。', rating:'昏' },
  { check:s=>s.treasury<=0&&s.military<=10, icon:'🏚️', title:'国破家亡', subtitle:'吴越国因财政崩溃而亡', desc:'国库空虚，军队哗变，吴越在内忧外患中走向覆灭。', rating:'庸' },
  { check:s=>s.military<=0, icon:'⚔️', title:'兵败国亡', subtitle:'吴越国被外敌所灭', desc:'军备废弛，外敌入侵，吴越无力抵抗，最终亡于刀兵之下。', rating:'弱' },
  { check:s=>false, icon:'👑', title:'功成身退', subtitle:'你完成了三十年的治国历程', desc:'三十年励精图治，吴越在你的治理下走过了风风雨雨。历史将永远铭记你的功过。', rating:null }
];

function checkGameOver(){
  for(let i=0;i<END_CONDITIONS.length-1;i++){
    if(END_CONDITIONS[i].check(G.stats)){ showEndScreen(END_CONDITIONS[i]); return true; }
  }
  if(G.turn>=30){ showEndScreen(END_CONDITIONS[END_CONDITIONS.length-1]); return true; }
  return false;
}

function getRating(s){
  const avg=(s.people+s.treasury+s.military+s.culture+s.diplomacy)/5;
  if(avg>=80) return '圣'; if(avg>=65) return '明'; if(avg>=50) return '良'; if(avg>=35) return '庸'; return '昏';
}

function showEndScreen(cond){
  G.gameOver=true;
  document.getElementById('game-screen').style.display='none';
  const es=document.getElementById('end-screen');
  es.classList.add('show');
  document.getElementById('end-icon').textContent=cond.icon;
  document.getElementById('end-title').textContent=cond.title;
  document.getElementById('end-subtitle').textContent=cond.subtitle;
  document.getElementById('end-years').textContent=G.turn+'年';
  document.getElementById('end-people').textContent=Math.round(G.stats.people);
  const rating=cond.rating||getRating(G.stats);
  document.getElementById('end-rating').textContent=rating;
  const ratingDescs={
    '圣':'你以圣明之治，使吴越成为乱世中的一片净土。百姓安居乐业，四方来朝，史书将你列为一代圣君。',
    '明':'你以明智之策，带领吴越度过了重重危机，国家繁荣昌盛。史书将你记为一代明君。',
    '良':'你的治理中规中矩，吴越在你的带领下保持了基本的稳定与繁荣。史书将你记为一位称职的君主。',
    '庸':'你的治理平平，吴越在你的带领下勉强维持，但未能有所作为。',
    '昏':'你的治理失当，吴越在你的带领下每况愈下。史书将你记为一位昏庸的君主。',
    '弱':'军备废弛，外敌入侵，吴越亡于你的手中。'
  };
  document.getElementById('end-desc').textContent=cond.desc+(cond.rating?'':('\n\n'+ratingDescs[rating]));
}

// ===================================================
//  游戏启动 / 重启
// ===================================================
function startGame(){
  document.getElementById('start-screen').style.display='none';
  document.getElementById('game-screen').style.display='flex';

  // 重置状态
  G.turn=1;
  G.corruption=0.15;  // 初始贪腐率15%
  G.stats={
    people:70, stability:72, culture:65,
    military:55, defense:60,
    treasury:60, commerce:50, agri:68,
    diplomacy:50, prestige:55,
    population:280, grain:420
  };
  // 计算初始年度预算
  const initTax = calcAnnualTax();
  G.budget = initTax.total;
  G.budgetUsed = 0;

  G.yearEvents=[]; G.usedEventIds=new Set(); G.history=[]; G.intel=[];
  G.gameOver=false;
  G.currentSystem='zhengwu';
  G.prefectureView=null;
  G.war=null; G.warHistory=[];
  G.taxRate='normal';
  G.vacantOffices=[];
  G.envoyQueue=[];
  G.activeDisaster=null;
  G.tradeRoutes=[];
  G.examCycle=0;
  G.examInvestment=0;
  G.prefPopulation={};
  G.migrationDone=false;
  G.trainingOrders=[];
  G.spyMissions=[];
  G.intelRevealed={};
  G.heirs=[];
  G.crownPrinceId=null;
  G.successionCrisis=false;
  // 初始化各州人口
  PREFECTURES.forEach(p=>{ G.prefPopulation[p.id] = p.population || Math.round(G.stats.population/PREFECTURES.length); });
  // 初始化子嗣（钱弘俶28岁，初始有1-2个幼子）
  _initHeirs();
  // 重置军队单位
  MILITARY_UNITS.forEach(u=>{ u.morale=Math.max(60,u.morale); u.supply=Math.max(60,u.supply); });
  // 重置NATIONS关系
  NATIONS.forEach(n=>{ if(n.id==='nantang') n.relation=35; else if(n.id==='min') n.relation=40; else if(n.id==='wuyue_pirates') n.relation=20; });

  // 重置官员忠诚度
  [...COURT_OFFICIALS,...CIVIL_OFFICIALS,...MILITARY_OFFICIALS].forEach(o=>{
    o.loyalty=Math.max(60,Math.min(95,o.loyalty+Math.floor(Math.random()*10)-5));
  });

  renderMap();
  renderOfficialList();
  updateStats();
  renderActions();
  renderSysDetail(G.currentSystem);
  generateYearEvents();
  updateIntel();
  showIdleState();

  // 初始情报
  for(let i=0;i<3;i++) updateIntel();
}

function restartGame(){
  document.getElementById('end-screen').classList.remove('show');
  document.getElementById('start-screen').style.display='flex';
}

// ===================================================
//  官职定员表（OFFICE_ROSTER）
//  完整列出吴越国所有官职槽位，关联到对应数组和id
// ===================================================

// 官职分类及说明
// category: 'court'朝廷 | 'civil'州郡 | 'military'军队
// rank: 1=宰执 2=卿监 3=州刺史 4=州佐官 5=军都指挥 6=军佐官
// skillPref: 适合的专长（用于推荐匹配）
// array: 对应的官员数组名
// slotId: 对应官员的id（有人在任）或 null（空缺）

const OFFICE_ROSTER = [
  // ── 朝廷中枢（rank 1-2）──
  { id:'slot_court_01', title:'丞相·同平章事', category:'court', rank:1, emoji:'🧙',
    desc:'百官之首，总揽政务，辅佐国王治国安邦。', skillPref:['文治','外交'],
    array:'COURT_OFFICIALS', officialId:'cao_zhongda' },
  { id:'slot_court_02', title:'枢密使', category:'court', rank:1, emoji:'📋',
    desc:'掌管军政机要，传达王命，协调军政事务。', skillPref:['军政','军事'],
    array:'COURT_OFFICIALS', officialId:'shen_chongyi' },
  { id:'slot_court_03', title:'内枢密使', category:'court', rank:2, emoji:'🔑',
    desc:'掌管宫廷内务及机密事宜，国王最信任的近臣。', skillPref:['内政','礼制'],
    array:'COURT_OFFICIALS', officialId:'qian_renqian' },
  { id:'slot_court_04', title:'节度副使', category:'court', rank:2, emoji:'⚔️',
    desc:'协助节度使处理军政事务，统领地方军队。', skillPref:['军事','军政'],
    array:'COURT_OFFICIALS', officialId:'wu_yanfu' },
  { id:'slot_court_05', title:'两浙转运使', category:'court', rank:2, emoji:'💰',
    desc:'主管两浙财赋转运，掌握国家财政命脉。', skillPref:['财政','农政'],
    array:'COURT_OFFICIALS', officialId:'qian_weizhi' },
  { id:'slot_court_06', title:'都指挥使', category:'court', rank:2, emoji:'🗡️',
    desc:'统领禁军，拱卫王都，是最精锐军队的统帅。', skillPref:['军事','军政'],
    array:'COURT_OFFICIALS', officialId:'ding_deyu' },
  { id:'slot_court_07', title:'镇海节度使', category:'court', rank:1, emoji:'🏯',
    desc:'镇守杭州，统领镇海军，是吴越防御体系的核心。', skillPref:['军事','军政'],
    array:'COURT_OFFICIALS', officialId:'sun_chengyu' },
  { id:'slot_court_08', title:'翰林学士承旨', category:'court', rank:2, emoji:'✒️',
    desc:'翰林院首席，起草诏书，参与机密，文学之冠。', skillPref:['文治','礼制'],
    array:'COURT_OFFICIALS', officialId:'xu_xuan' },
  { id:'slot_court_09', title:'翰林学士', category:'court', rank:2, emoji:'📜',
    desc:'翰林院学士，起草文书，编修史籍，文化重臣。', skillPref:['文治','礼制'],
    array:'COURT_OFFICIALS', officialId:'lin_deyuan' },
  { id:'slot_court_10', title:'宗正卿', category:'court', rank:2, emoji:'🏛️',
    desc:'主管宗族事务及礼仪制度，维护王室血脉荣耀。', skillPref:['礼制','内政'],
    array:'COURT_OFFICIALS', officialId:'qian_hongzuo' },
  { id:'slot_court_11', title:'司农卿', category:'court', rank:2, emoji:'🌾',
    desc:'主管农业生产及粮食储备，关乎百姓衣食。', skillPref:['农政','水利'],
    array:'COURT_OFFICIALS', officialId:'wu_chengyi' },
  { id:'slot_court_12', title:'御史中丞', category:'court', rank:2, emoji:'⚖️',
    desc:'主管监察百官，执法严明，整肃吏治。', skillPref:['法律','文治'],
    array:'COURT_OFFICIALS', officialId:'chen_yue' },
  { id:'slot_court_13', title:'礼部尚书', category:'court', rank:2, emoji:'🎋',
    desc:'主管礼仪、科举及对外礼宾，外交礼仪之首。', skillPref:['礼制','外交'],
    array:'COURT_OFFICIALS', officialId:'fang_shao' },
  { id:'slot_court_14', title:'兵部尚书', category:'court', rank:2, emoji:'📯',
    desc:'主管军事行政，负责军队编制、粮草调配。', skillPref:['军政','军事'],
    array:'COURT_OFFICIALS', officialId:'zhang_yanwei' },
  { id:'slot_court_15', title:'给事中', category:'court', rank:2, emoji:'🖊️',
    desc:'审核诏令，封驳违失，是制衡权力的重要职位。', skillPref:['文治','法律'],
    array:'COURT_OFFICIALS', officialId:'luo_yin' },
  // 空缺朝廷职位（可由科举进士填补）
  { id:'slot_court_v1', title:'户部侍郎', category:'court', rank:2, emoji:'📊',
    desc:'协助管理户籍、赋税、财政，国家经济的重要助手。', skillPref:['财政','农政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_court_v2', title:'工部侍郎', category:'court', rank:2, emoji:'🏗️',
    desc:'主管土木工程、水利建设，关乎国家基础设施。', skillPref:['水利','工程'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_court_v3', title:'刑部侍郎', category:'court', rank:2, emoji:'⚖️',
    desc:'协助管理刑狱、司法，维护法律秩序。', skillPref:['法律','文治'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_court_v4', title:'吏部侍郎', category:'court', rank:2, emoji:'📋',
    desc:'协助管理官员铨选、考核、升降，掌握官员命运。', skillPref:['文治','内政'],
    array:'COURT_OFFICIALS', officialId:null },

  // ── 州郡官员（rank 3-4）──
  // 杭州（首府）
  { id:'slot_hz_zhi', title:'杭州刺史', category:'civil', rank:3, emoji:'🏛️',
    desc:'镇守首府杭州，总揽一州政务军事。', skillPref:['内政','文治'],
    array:'CIVIL_OFFICIALS', officialId:'hz_zhi' },
  { id:'slot_hz_tong', title:'杭州通判', category:'civil', rank:4, emoji:'📋',
    desc:'协助刺史处理政务，负责司法及财政监督。', skillPref:['法律','财政'],
    array:'CIVIL_OFFICIALS', officialId:'hz_tong' },
  { id:'slot_hz_wei', title:'杭州司马', category:'civil', rank:4, emoji:'📜',
    desc:'协助处理杭州军政事务，参赞军机。', skillPref:['军政','文治'],
    array:'CIVIL_OFFICIALS', officialId:'hz_wei' },
  // 越州
  { id:'slot_yz_zhi', title:'越州刺史', category:'civil', rank:3, emoji:'🏯',
    desc:'镇守越州，越州乃吴越粮仓，农业重地。', skillPref:['农政','内政'],
    array:'CIVIL_OFFICIALS', officialId:'yz_zhi' },
  { id:'slot_yz_tong', title:'越州通判', category:'civil', rank:4, emoji:'⚖️',
    desc:'协助越州刺史，负责司法及财政监督。', skillPref:['法律','财政'],
    array:'CIVIL_OFFICIALS', officialId:'yz_tong' },
  { id:'slot_yz_wei', title:'越州司马', category:'civil', rank:4, emoji:'⚔️',
    desc:'协助处理越州军政事务。', skillPref:['军政','军事'],
    array:'CIVIL_OFFICIALS', officialId:'yz_wei' },
  // 湖州
  { id:'slot_huz_zhi', title:'湖州刺史', category:'civil', rank:3, emoji:'🌊',
    desc:'镇守湖州，湖州水网密布，水利重地。', skillPref:['水利','内政'],
    array:'CIVIL_OFFICIALS', officialId:'huz_zhi' },
  { id:'slot_huz_tong', title:'湖州通判', category:'civil', rank:4, emoji:'📋',
    desc:'协助湖州刺史，负责财赋征收。', skillPref:['财政','内政'],
    array:'CIVIL_OFFICIALS', officialId:'huz_tong' },
  { id:'slot_huz_wei', title:'湖州司马', category:'civil', rank:4, emoji:'🏛️',
    desc:'协助处理湖州军政事务。', skillPref:['礼制','内政'],
    array:'CIVIL_OFFICIALS', officialId:'huz_wei' },
  // 明州
  { id:'slot_mz_zhi', title:'明州刺史', category:'civil', rank:3, emoji:'⛵',
    desc:'镇守明州，主管港口及海上贸易。', skillPref:['外交','财政'],
    array:'CIVIL_OFFICIALS', officialId:'mz_zhi' },
  { id:'slot_mz_tong', title:'明州通判', category:'civil', rank:4, emoji:'💰',
    desc:'负责明州商税征收及港口管理。', skillPref:['财政','外交'],
    array:'CIVIL_OFFICIALS', officialId:'mz_tong' },
  { id:'slot_mz_wei', title:'明州司马', category:'civil', rank:4, emoji:'⚔️',
    desc:'负责明州海防，抵御海寇。', skillPref:['军事','军政'],
    array:'CIVIL_OFFICIALS', officialId:'mz_wei' },
  // 台州
  { id:'slot_tz_zhi', title:'台州刺史', category:'civil', rank:3, emoji:'🏔️',
    desc:'镇守台州，台州山地众多，农业开发重地。', skillPref:['农政','内政'],
    array:'CIVIL_OFFICIALS', officialId:'tz_zhi' },
  { id:'slot_tz_tong', title:'台州通判', category:'civil', rank:4, emoji:'📋',
    desc:'协助台州刺史处理政务。', skillPref:['文治','内政'],
    array:'CIVIL_OFFICIALS', officialId:'tz_tong' },
  { id:'slot_tz_wei', title:'台州司马', category:'civil', rank:4, emoji:'🗡️',
    desc:'负责台州军事防务。', skillPref:['军事','军政'],
    array:'CIVIL_OFFICIALS', officialId:'tz_wei' },
  // 空缺州郡职位
  { id:'slot_wz_zhi', title:'温州刺史', category:'civil', rank:3, emoji:'🌊',
    desc:'镇守温州，温州海岸线长，渔业贸易发达。', skillPref:['外交','财政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_wz_tong', title:'温州通判', category:'civil', rank:4, emoji:'📋',
    desc:'协助温州刺史处理政务财赋。', skillPref:['财政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_sz_zhi', title:'苏州刺史', category:'civil', rank:3, emoji:'🏙️',
    desc:'镇守苏州，苏州富庶，丝绸之乡，商业重镇。', skillPref:['财政','外交'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_sz_tong', title:'苏州通判', category:'civil', rank:4, emoji:'📋',
    desc:'协助苏州刺史，负责商税及丝绸贸易管理。', skillPref:['财政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },

  // ── 军队职位（rank 5-6）──
  // 镇海军
  { id:'slot_zh_du', title:'镇海军都指挥使', category:'military', rank:5, emoji:'⚔️',
    desc:'统领镇海军主力，驻守杭州，吴越最重要的军事将领。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:'zh_du' },
  { id:'slot_zh_fu', title:'镇海军副指挥使', category:'military', rank:6, emoji:'🗡️',
    desc:'协助统领镇海军，以骑兵作战见长。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:'zh_fu' },
  { id:'slot_zh_pan', title:'镇海军判官', category:'military', rank:6, emoji:'📯',
    desc:'负责镇海军军政事务，处理军队文书、粮草调配。', skillPref:['军政','财政'],
    array:'MILITARY_OFFICIALS', officialId:'zh_pan' },
  // 镇东军
  { id:'slot_zd_du', title:'镇东军都指挥使', category:'military', rank:5, emoji:'⚔️',
    desc:'统领镇东军，驻守越州，防御闽国方向。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:'zd_du' },
  { id:'slot_zd_fu', title:'镇东军副指挥使', category:'military', rank:6, emoji:'🗡️',
    desc:'协助统领镇东军，尤擅水战。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:'zd_fu' },
  { id:'slot_zd_pan', title:'镇东军判官', category:'military', rank:6, emoji:'📯',
    desc:'负责镇东军军政事务。', skillPref:['军政','内政'],
    array:'MILITARY_OFFICIALS', officialId:'zd_pan' },
  // 水师
  { id:'slot_ws_du', title:'水师都指挥使', category:'military', rank:5, emoji:'⛵',
    desc:'统领吴越水师，驻守明州，精通水战。', skillPref:['军事','外交'],
    array:'MILITARY_OFFICIALS', officialId:'ws_du' },
  { id:'slot_ws_fu', title:'水师副指挥使', category:'military', rank:6, emoji:'🌊',
    desc:'协助统领水师，善于利用地形和潮汐作战。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:'ws_fu' },
  { id:'slot_ws_pan', title:'水师判官', category:'military', rank:6, emoji:'📋',
    desc:'负责水师后勤及港口管理。', skillPref:['军政','财政'],
    array:'MILITARY_OFFICIALS', officialId:'ws_pan' },
  // 边境守备军
  { id:'slot_bj_du', title:'边境守备都指挥使', category:'military', rank:5, emoji:'🏯',
    desc:'统领湖州边境守备军，专门防御南唐方向。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:'bj_du' },
  { id:'slot_bj_fu', title:'边境守备副指挥使', category:'military', rank:6, emoji:'⚔️',
    desc:'协助统领边境守备军，善于侦察敌情。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:'bj_fu' },
  { id:'slot_bj_pan', title:'边境守备判官', category:'military', rank:6, emoji:'📯',
    desc:'负责边境守备军的军政事务。', skillPref:['军政','内政'],
    array:'MILITARY_OFFICIALS', officialId:'bj_pan' },
  // 空缺军队职位
  { id:'slot_mil_v1', title:'禁军副指挥使', category:'military', rank:6, emoji:'🗡️',
    desc:'协助都指挥使统领禁军，拱卫王都。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_v2', title:'水师判官（候补）', category:'military', rank:6, emoji:'📋',
    desc:'协助水师判官处理后勤事务。', skillPref:['军政','财政'],
    array:'MILITARY_OFFICIALS', officialId:null },

  // ══════════════════════════════════════════════════
  //  低级官职（rank 7-9，全部初始空缺，科举进士的主要去处）
  //  rank 7 = 朝廷郎官 / 州县主官
  //  rank 8 = 县丞主簿 / 军中小将
  //  rank 9 = 基层小吏 / 候补见习
  // ══════════════════════════════════════════════════

  // ── 朝廷郎官（rank 7，文职，全部空缺）──
  { id:'slot_lo_01', title:'户部郎中', category:'court', rank:7, emoji:'📊',
    desc:'协助户部侍郎管理户籍赋税，负责具体账目核查与征收事务。', skillPref:['财政','农政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_02', title:'户部员外郎', category:'court', rank:8, emoji:'📊',
    desc:'户部郎中的副手，处理日常赋税文书，核对各州上报账目。', skillPref:['财政','内政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_03', title:'礼部郎中', category:'court', rank:7, emoji:'🎋',
    desc:'协助礼部尚书主持科举考务、礼仪典章及宾客接待事宜。', skillPref:['礼制','文治'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_04', title:'礼部员外郎', category:'court', rank:8, emoji:'🎋',
    desc:'礼部郎中副手，负责典礼文书起草与礼仪细节安排。', skillPref:['礼制','文治'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_05', title:'兵部郎中', category:'court', rank:7, emoji:'📯',
    desc:'协助兵部尚书处理军籍、军械、军粮调拨的具体事务。', skillPref:['军政','财政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_06', title:'兵部员外郎', category:'court', rank:8, emoji:'📯',
    desc:'兵部郎中副手，负责军队文书传递与军械库存核查。', skillPref:['军政','内政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_07', title:'刑部郎中', category:'court', rank:7, emoji:'⚖️',
    desc:'协助刑部侍郎审理案件，负责刑狱文书与判决复核。', skillPref:['法律','文治'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_08', title:'刑部员外郎', category:'court', rank:8, emoji:'⚖️',
    desc:'刑部郎中副手，负责案件档案整理与囚犯管理事务。', skillPref:['法律','内政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_09', title:'工部郎中', category:'court', rank:7, emoji:'🏗️',
    desc:'协助工部侍郎督导水利、道路、宫室等工程建设事务。', skillPref:['水利','工程'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_10', title:'工部员外郎', category:'court', rank:8, emoji:'🏗️',
    desc:'工部郎中副手，负责工程预算核算与材料调配。', skillPref:['工程','财政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_11', title:'吏部郎中', category:'court', rank:7, emoji:'📋',
    desc:'协助吏部侍郎主持官员考核、铨选与升降事务。', skillPref:['文治','内政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_12', title:'吏部员外郎', category:'court', rank:8, emoji:'📋',
    desc:'吏部郎中副手，负责官员档案整理与任命文书起草。', skillPref:['内政','文治'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_13', title:'翰林院待诏', category:'court', rank:7, emoji:'✒️',
    desc:'翰林院候补学士，协助起草诏书，参与文史编修工作。', skillPref:['文治','礼制'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_14', title:'翰林院编修', category:'court', rank:8, emoji:'📜',
    desc:'负责史书编修与典籍整理，是翰林院的基础文职。', skillPref:['文治','礼制'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_15', title:'御史台监察御史', category:'court', rank:7, emoji:'🔍',
    desc:'代表御史台巡察地方，监督官员廉洁，纠察不法行为。', skillPref:['法律','文治'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_16', title:'御史台殿中侍御史', category:'court', rank:8, emoji:'⚖️',
    desc:'负责朝廷礼仪纠察，监督百官朝会行为是否合乎规范。', skillPref:['礼制','法律'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_17', title:'秘书省校书郎', category:'court', rank:8, emoji:'📖',
    desc:'负责宫廷藏书校勘整理，是文人入仕的常见起步官职。', skillPref:['文治','礼制'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_18', title:'秘书省正字', category:'court', rank:9, emoji:'📖',
    desc:'协助校书郎整理典籍，纠正文字错误，是最基层的文职。', skillPref:['文治','礼制'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_19', title:'太常寺博士', category:'court', rank:7, emoji:'🛕',
    desc:'掌管礼乐祭祀典章，负责国家重大祭典的礼仪规程。', skillPref:['礼制','文治'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_20', title:'太常寺协律郎', category:'court', rank:8, emoji:'🎵',
    desc:'负责宫廷音乐礼仪，掌管乐器调律与祭祀乐章演奏。', skillPref:['礼制','文治'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_21', title:'国子监博士', category:'court', rank:7, emoji:'🎓',
    desc:'在国子监讲授经史，培育官员子弟，是文教的重要职位。', skillPref:['文治','礼制'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_22', title:'国子监助教', category:'court', rank:8, emoji:'🎓',
    desc:'协助国子监博士教学，负责学生日常管理与课业考核。', skillPref:['文治','内政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_23', title:'司天监主簿', category:'court', rank:8, emoji:'🌙',
    desc:'协助司天监观测天象，记录气候变化，为农业生产提供参考。', skillPref:['农政','工程'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_24', title:'太医署医正', category:'court', rank:7, emoji:'💊',
    desc:'主管宫廷医疗事务，负责王室及官员的医药保障。', skillPref:['医术','内政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_lo_25', title:'太医署医师', category:'court', rank:8, emoji:'💊',
    desc:'在太医署行医，为宫廷人员诊治疾病，兼管药材储备。', skillPref:['医术','内政'],
    array:'COURT_OFFICIALS', officialId:null },

  // ── 各州县官员（rank 7-8，全部空缺）──
  // 杭州属县
  { id:'slot_hz_xian_01', title:'钱塘县令', category:'civil', rank:7, emoji:'🏙️',
    desc:'治理杭州首县钱塘，负责一县赋税、司法、治安事务。', skillPref:['内政','法律'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_hz_xian_02', title:'钱塘县丞', category:'civil', rank:8, emoji:'📋',
    desc:'协助钱塘县令处理政务，主管文书档案与日常行政。', skillPref:['内政','文治'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_hz_xian_03', title:'仁和县令', category:'civil', rank:7, emoji:'🏘️',
    desc:'治理杭州仁和县，负责农业生产与地方治安。', skillPref:['农政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_hz_xian_04', title:'仁和县主簿', category:'civil', rank:8, emoji:'📋',
    desc:'协助仁和县令，负责户籍管理与赋税征收文书。', skillPref:['财政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  // 越州属县
  { id:'slot_yz_xian_01', title:'会稽县令', category:'civil', rank:7, emoji:'🌾',
    desc:'治理越州首县会稽，越州粮仓核心，农业管理重地。', skillPref:['农政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_yz_xian_02', title:'会稽县丞', category:'civil', rank:8, emoji:'📋',
    desc:'协助会稽县令，负责粮食征收与仓储管理。', skillPref:['农政','财政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_yz_xian_03', title:'山阴县令', category:'civil', rank:7, emoji:'🏔️',
    desc:'治理越州山阴县，负责山地开垦与水利灌溉事务。', skillPref:['水利','农政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  // 湖州属县
  { id:'slot_huz_xian_01', title:'乌程县令', category:'civil', rank:7, emoji:'🌊',
    desc:'治理湖州乌程县，湖州水网中心，水利工程要地。', skillPref:['水利','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_huz_xian_02', title:'乌程县丞', category:'civil', rank:8, emoji:'📋',
    desc:'协助乌程县令，负责水利工程维护与农田水利文书。', skillPref:['水利','农政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_huz_xian_03', title:'长城县令', category:'civil', rank:7, emoji:'🏯',
    desc:'治理湖州长城县，地处边境，兼顾民政与边防协调。', skillPref:['内政','军政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  // 明州属县
  { id:'slot_mz_xian_01', title:'鄞县县令', category:'civil', rank:7, emoji:'⛵',
    desc:'治理明州鄞县，港口贸易重地，负责商税与港务管理。', skillPref:['财政','外交'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_mz_xian_02', title:'鄞县主簿', category:'civil', rank:8, emoji:'💰',
    desc:'协助鄞县县令，负责港口商税账目与贸易文书管理。', skillPref:['财政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_mz_xian_03', title:'慈溪县令', category:'civil', rank:7, emoji:'🌊',
    desc:'治理明州慈溪县，沿海渔业重地，负责渔税与海防协调。', skillPref:['内政','农政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  // 台州属县
  { id:'slot_tz_xian_01', title:'临海县令', category:'civil', rank:7, emoji:'🏔️',
    desc:'治理台州临海县，台州首县，负责山地农业与地方治安。', skillPref:['农政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_tz_xian_02', title:'临海县丞', category:'civil', rank:8, emoji:'📋',
    desc:'协助临海县令处理政务，负责文书档案与赋税征收。', skillPref:['内政','财政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  // 温州属县（温州刺史空缺，属县也空缺）
  { id:'slot_wz_xian_01', title:'永嘉县令', category:'civil', rank:7, emoji:'🌊',
    desc:'治理温州永嘉县，温州首县，负责海贸与渔业管理。', skillPref:['外交','财政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_wz_xian_02', title:'永嘉县丞', category:'civil', rank:8, emoji:'📋',
    desc:'协助永嘉县令，负责商税征收与港口日常管理。', skillPref:['财政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  // 苏州属县（苏州刺史空缺，属县也空缺）
  { id:'slot_sz_xian_01', title:'吴县县令', category:'civil', rank:7, emoji:'🏙️',
    desc:'治理苏州吴县，苏州首县，丝绸重地，商业繁华。', skillPref:['财政','外交'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_sz_xian_02', title:'吴县主簿', category:'civil', rank:8, emoji:'💰',
    desc:'协助吴县县令，负责丝绸商税账目与市场管理文书。', skillPref:['财政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_sz_xian_03', title:'长洲县令', category:'civil', rank:7, emoji:'🏘️',
    desc:'治理苏州长洲县，负责农桑生产与地方治安。', skillPref:['农政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  // 各州通用候补官职
  { id:'slot_civ_v01', title:'两浙盐铁判官', category:'civil', rank:7, emoji:'🧂',
    desc:'负责两浙盐铁专卖事务，监督盐场生产与铁器流通。', skillPref:['财政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v02', title:'两浙营田判官', category:'civil', rank:7, emoji:'🌾',
    desc:'负责两浙官田开垦与屯田管理，增加国家粮食储备。', skillPref:['农政','水利'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v03', title:'两浙市舶判官', category:'civil', rank:7, emoji:'⛵',
    desc:'负责两浙海外贸易管理，征收市舶税，接待外国商人。', skillPref:['外交','财政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v04', title:'转运司勾当公事', category:'civil', rank:8, emoji:'📦',
    desc:'协助转运使处理财赋转运的具体事务，负责押运与账目。', skillPref:['财政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v05', title:'提点刑狱', category:'civil', rank:7, emoji:'⚖️',
    desc:'巡察两浙各州刑狱，复核重大案件，防止冤假错案。', skillPref:['法律','文治'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v06', title:'劝农使', category:'civil', rank:7, emoji:'🌱',
    desc:'巡察各州农业生产，推广新式农具与耕作技术，劝课农桑。', skillPref:['农政','水利'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v07', title:'水利判官', category:'civil', rank:8, emoji:'💧',
    desc:'专职负责两浙水利工程规划与维护，防洪抗旱的技术官员。', skillPref:['水利','工程'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v08', title:'仓曹参军', category:'civil', rank:8, emoji:'🏚️',
    desc:'负责各州粮仓管理，监督粮食储备与调拨，防止亏空。', skillPref:['农政','财政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v09', title:'法曹参军', category:'civil', rank:8, emoji:'⚖️',
    desc:'协助刺史处理司法事务，负责诉讼文书与案件初审。', skillPref:['法律','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v10', title:'录事参军', category:'civil', rank:8, emoji:'📋',
    desc:'负责州府文书档案管理，是刺史府的核心文职助手。', skillPref:['内政','文治'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v11', title:'司户参军', category:'civil', rank:8, emoji:'👥',
    desc:'负责户籍管理与人口统计，掌握一州人丁土地数据。', skillPref:['内政','农政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_civ_v12', title:'司兵参军', category:'civil', rank:8, emoji:'🗡️',
    desc:'协助刺史处理地方军事事务，负责民兵训练与武器管理。', skillPref:['军政','内政'],
    array:'CIVIL_OFFICIALS', officialId:null },

  // ── 军队基层职位（rank 7-9，全部空缺）──
  { id:'slot_mil_lo_01', title:'镇海军兵马使', category:'military', rank:7, emoji:'⚔️',
    desc:'统领镇海军一营兵马，负责具体战术训练与日常操练。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_02', title:'镇海军押衙', category:'military', rank:8, emoji:'🗡️',
    desc:'镇海军中级军官，负责传达军令、维持军纪。', skillPref:['军政','军事'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_03', title:'镇东军兵马使', category:'military', rank:7, emoji:'⚔️',
    desc:'统领镇东军一营兵马，驻守越州前线，防御闽国。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_04', title:'镇东军押衙', category:'military', rank:8, emoji:'🗡️',
    desc:'镇东军中级军官，负责军令传达与士卒管理。', skillPref:['军政','军事'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_05', title:'水师兵马使', category:'military', rank:7, emoji:'⛵',
    desc:'统领水师一营战船，负责海上巡逻与港口防卫。', skillPref:['军事','外交'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_06', title:'水师押衙', category:'military', rank:8, emoji:'🌊',
    desc:'水师中级军官，负责战船维护与水手训练管理。', skillPref:['军政','工程'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_07', title:'边境守备兵马使', category:'military', rank:7, emoji:'🏯',
    desc:'统领边境守备军一营，驻守湖州边境要塞。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_08', title:'边境守备押衙', category:'military', rank:8, emoji:'⚔️',
    desc:'边境守备军中级军官，负责烽火传递与哨所管理。', skillPref:['军政','军事'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_09', title:'禁军兵马使', category:'military', rank:7, emoji:'🗡️',
    desc:'统领禁军一营，拱卫王都杭州，是最精锐的近卫力量。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_10', title:'禁军押衙', category:'military', rank:8, emoji:'🗡️',
    desc:'禁军中级军官，负责宫廷警卫与王都巡逻事务。', skillPref:['军政','军事'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_11', title:'军器监丞', category:'military', rank:7, emoji:'⚒️',
    desc:'负责军械制造与武器库管理，确保军队武器供应充足。', skillPref:['工程','军政'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_12', title:'军器监主簿', category:'military', rank:8, emoji:'📋',
    desc:'协助军器监丞，负责武器账目核查与工匠管理。', skillPref:['工程','内政'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_13', title:'粮料院判官', category:'military', rank:8, emoji:'🌾',
    desc:'负责军队粮草调配与后勤保障，是军队运转的关键。', skillPref:['农政','财政'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_mil_lo_14', title:'马步军都虞候', category:'military', rank:7, emoji:'🐴',
    desc:'负责军队纪律执法，处理军中违纪案件，维护军法。', skillPref:['法律','军政'],
    array:'MILITARY_OFFICIALS', officialId:null },

  // ── 候补见习（rank 9，最低级，全部空缺，适合刚入仕的进士）──
  { id:'slot_jr_01', title:'承事郎（候补）', category:'court', rank:9, emoji:'📜',
    desc:'朝廷候补文官，等待实缺，期间在各部司见习学习政务。', skillPref:['文治','内政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_jr_02', title:'宣义郎（候补）', category:'court', rank:9, emoji:'📜',
    desc:'朝廷候补文官，专长礼仪外交，等待礼部或鸿胪寺实缺。', skillPref:['礼制','外交'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_jr_03', title:'修职郎（候补）', category:'court', rank:9, emoji:'📜',
    desc:'朝廷候补文官，专长农政水利，等待司农寺或工部实缺。', skillPref:['农政','水利'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_jr_04', title:'迪功郎（候补）', category:'court', rank:9, emoji:'📜',
    desc:'朝廷候补文官，专长财政，等待户部或转运司实缺。', skillPref:['财政','内政'],
    array:'COURT_OFFICIALS', officialId:null },
  { id:'slot_jr_05', title:'县尉（候补）', category:'civil', rank:9, emoji:'🏘️',
    desc:'候补县尉，等待各县实缺，主管一县治安与捕盗事务。', skillPref:['法律','军政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_jr_06', title:'县尉（候补）', category:'civil', rank:9, emoji:'🏘️',
    desc:'候补县尉，等待各县实缺，主管一县治安与捕盗事务。', skillPref:['法律','军政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_jr_07', title:'县尉（候补）', category:'civil', rank:9, emoji:'🏘️',
    desc:'候补县尉，等待各县实缺，主管一县治安与捕盗事务。', skillPref:['法律','军政'],
    array:'CIVIL_OFFICIALS', officialId:null },
  { id:'slot_jr_08', title:'队正（候补）', category:'military', rank:9, emoji:'🗡️',
    desc:'候补军队基层军官，等待各军营实缺，统领一队士卒。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_jr_09', title:'队正（候补）', category:'military', rank:9, emoji:'🗡️',
    desc:'候补军队基层军官，等待各军营实缺，统领一队士卒。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:null },
  { id:'slot_jr_10', title:'队正（候补）', category:'military', rank:9, emoji:'🗡️',
    desc:'候补军队基层军官，等待各军营实缺，统领一队士卒。', skillPref:['军事','军政'],
    array:'MILITARY_OFFICIALS', officialId:null },
];

// 获取某个槽位当前在任官员
function getSlotOfficial(slot){
  if(!slot.officialId) return null;
  const arr = slot.array==='COURT_OFFICIALS'?COURT_OFFICIALS
             :slot.array==='CIVIL_OFFICIALS'?CIVIL_OFFICIALS
             :MILITARY_OFFICIALS;
  return arr.find(o=>o.id===slot.officialId)||null;
}

// 获取所有空缺槽位
function getVacantSlots(){
  return OFFICE_ROSTER.filter(slot=>{
    if(!slot.officialId) return true; // 原本就是空缺
    const official = getSlotOfficial(slot);
    return !official; // 在任官员已被移除（致仕/叛变等）
  });
}

// 获取所有在任槽位
function getFilledSlots(){
  return OFFICE_ROSTER.filter(slot=>{
    if(!slot.officialId) return false;
    return !!getSlotOfficial(slot);
  });
}

// 将进士任命到某个槽位
function appointToSlot(scholar, slotId){
  const slot = OFFICE_ROSTER.find(s=>s.id===slotId);
  if(!slot) return;
  const arr = slot.array==='COURT_OFFICIALS'?COURT_OFFICIALS
             :slot.array==='CIVIL_OFFICIALS'?CIVIL_OFFICIALS
             :MILITARY_OFFICIALS;
  // 生成新官员对象
  const newOfficial = {
    ...scholar,
    id: `appt_${slotId}_${Date.now()}`,
    role: slot.title,
    color: slot.category==='court'?'#2d6a4f':slot.category==='civil'?'#1a3a5c':'#8b1a1a',
  };
  arr.push(newOfficial);
  slot.officialId = newOfficial.id;
}

// ===================================================
//  科举取士系统（重构：按官职槽位任命）
// ===================================================

const SCHOLAR_SURNAMES = ['王','李','张','刘','陈','杨','赵','黄','周','吴','徐','孙','朱','马','胡','郭','林','何','高','梁','郑','罗','宋','谢','唐','韩','曹','许','邓','萧'];
const SCHOLAR_GIVEN = ['文','武','德','仁','义','礼','智','信','忠','孝','廉','勇','明','贤','达','通','博','远','深','厚','正','清','廉','直','刚','毅','敏','慧','睿','哲'];
const SCHOLAR_SKILLS = ['文治','农政','财政','军政','外交','法律','水利','礼制','工程','医术'];
const SCHOLAR_TRAITS = ['勤勉','博学','务实','清廉','机敏','稳重','刚直','仁厚','精明','谨慎'];
const SCHOLAR_EMOJIS = ['📚','✒️','📜','🖊️','🎋','📖','🔬','⚖️','🌾','💡'];

function generateScholar(){
  const surname = SCHOLAR_SURNAMES[Math.floor(Math.random()*SCHOLAR_SURNAMES.length)];
  const given1 = SCHOLAR_GIVEN[Math.floor(Math.random()*SCHOLAR_GIVEN.length)];
  const given2 = Math.random()>0.5 ? SCHOLAR_GIVEN[Math.floor(Math.random()*SCHOLAR_GIVEN.length)] : '';
  const skill = SCHOLAR_SKILLS[Math.floor(Math.random()*SCHOLAR_SKILLS.length)];
  const trait = SCHOLAR_TRAITS[Math.floor(Math.random()*SCHOLAR_TRAITS.length)];
  const ability = 55 + Math.floor(Math.random()*35);
  const age = 22 + Math.floor(Math.random()*18);
  const emoji = SCHOLAR_EMOJIS[Math.floor(Math.random()*SCHOLAR_EMOJIS.length)];
  const rank = Math.random()<0.15?'状元':Math.random()<0.25?'榜眼':Math.random()<0.35?'探花':'进士';
  const abilityBonus = rank==='状元'?15:rank==='榜眼'?10:rank==='探花'?5:0;
  return {
    id: `scholar_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    name: surname+given1+given2,
    rank, skill, trait, ability: Math.min(95, ability+abilityBonus),
    age, emoji,
    loyalty: 75 + Math.floor(Math.random()*20),
    color: '#2d6a4f',
    role: '待授官职',
    assignedSlot: null,  // 选定的官职槽位id，null=赋闲
    bio: `${rank}出身，专长${skill}，性格${trait}。年${age}岁，才学出众，有志于仕途。`,
    isScholar: true,
  };
}

function openExamModal(){
  const count = 3 + Math.floor(G.stats.culture/25);
  const cheatChance = Math.max(0, 0.15 - G.stats.culture*0.001);
  const cheated = Math.random() < cheatChance;

  G.scholars = [];
  for(let i=0;i<count;i++) G.scholars.push(generateScholar());

  const sub = document.getElementById('exam-modal-sub');
  const vacantCount = getVacantSlots().length;

  sub.textContent = cheated
    ? `⚠️ 本届科举发现舞弊迹象！共录取 ${count} 名士子，当前空缺官职 ${vacantCount} 个，请大王钦点授职`
    : `本届共录取 ${count} 名士子，当前空缺官职 ${vacantCount} 个，请大王为每位进士钦点官职`;

  if(cheated){
    applyEffects({culture:-4, people:-3});
    addHistory('科举发现舞弊，文治声誉受损','bad');
  } else {
    applyEffects({culture:+5});
  }

  renderExamScholars();
  document.getElementById('exam-modal').classList.add('show');
}

// 品级名称映射
const RANK_LABEL = {
  1:'正一品', 2:'从二品', 3:'正四品', 4:'从五品',
  5:'正五品', 6:'从六品', 7:'正七品', 8:'从八品', 9:'从九品'
};

// 渲染科举弹窗：每位进士一张卡，右侧是官职选择下拉
function renderExamScholars(){
  const body = document.getElementById('exam-modal-body');
  if(!body) return;

  // 获取空缺槽位
  const vacant = getVacantSlots();
  // 已被本届其他进士选走的槽位（实时排除）
  const takenSlots = ()=> new Set(G.scholars.map(s=>s.assignedSlot).filter(Boolean));

  body.innerHTML = G.scholars.map((s,i)=>{
    const rankColor = s.rank==='状元'?'#e8c97a':s.rank==='榜眼'?'#c0c0c0':s.rank==='探花'?'#cd7f32':'var(--text-dim)';
    // 构建官职选项，按朝廷/州郡/军队分组，组内按品级排序
    const taken = takenSlots();
    const buildGroup = (cat, label) => {
      const slots = vacant
        .filter(sl=>sl.category===cat)
        .sort((a,b)=>a.rank-b.rank);
      if(slots.length===0) return '';
      const opts = slots.map(slot=>{
        const isMe = slot.id===s.assignedSlot;
        const isTaken = !isMe && taken.has(slot.id);
        const matchMark = slot.skillPref.includes(s.skill) ? '★' : '　';
        const rankStr = RANK_LABEL[slot.rank]||`${slot.rank}品`;
        const prefix = isTaken ? '[已选] ' : '';
        return `<option value="${slot.id}" ${isMe?'selected':''} ${isTaken?'disabled':''}>
          ${prefix}${matchMark} [${rankStr}] ${slot.title}
        </option>`;
      }).join('');
      return `<optgroup label="── ${label} ──">${opts}</optgroup>`;
    };
    const options = buildGroup('court','朝廷') + buildGroup('civil','州郡') + buildGroup('military','军队');

    const selectedSlot = s.assignedSlot ? OFFICE_ROSTER.find(sl=>sl.id===s.assignedSlot) : null;
    const slotDesc = selectedSlot
      ? `<div class="esc-slot-desc">${selectedSlot.emoji} ${selectedSlot.desc}</div>`
      : `<div class="esc-slot-desc" style="color:var(--text-muted)">选择赋闲则暂不授职，可日后启用</div>`;

    return `<div class="exam-scholar-card" id="esc-${i}">
      <div class="esc-avatar">${s.emoji}</div>
      <div class="esc-info">
        <div class="esc-name">${s.name} <span style="font-size:10px;color:${rankColor};font-weight:700">${s.rank}</span></div>
        <div class="esc-tags">
          <span class="esc-tag skill">专长：${s.skill}</span>
          <span class="esc-tag ability">能力：${s.ability}</span>
          <span class="esc-tag">年龄：${s.age}岁</span>
          <span class="esc-tag">${s.trait}</span>
        </div>
        <div class="esc-assign-row">
          <select class="esc-slot-select" onchange="setScholarSlot(${i},this.value)">
            <option value="">⬜ 暂不授职（赋闲）</option>
            ${options}
          </select>
        </div>
        ${slotDesc}
      </div>
    </div>`;
  }).join('');
}

// 玩家为某位进士选择官职槽位
function setScholarSlot(idx, slotId){
  G.scholars[idx].assignedSlot = slotId || null;
  // 重新渲染（更新其他进士的可选项，排除已选）
  renderExamScholars();
}

function confirmExamAssign(){
  let appointed=0, idled=0;
  const results = [];

  G.scholars.forEach(s=>{
    if(s.assignedSlot){
      appointToSlot(s, s.assignedSlot);
      const slot = OFFICE_ROSTER.find(sl=>sl.id===s.assignedSlot);
      results.push(`${s.name}→${slot?slot.title:'官职'}`);
      appointed++;
      applyEffects({culture:+2, stability:+1});
    } else {
      s.role = '赋闲士子';
      G.idleScholars.push(s);
      idled++;
      applyEffects({culture:+1});
    }
  });

  G.scholars = [];
  document.getElementById('exam-modal').classList.remove('show');

  const desc = appointed>0
    ? `科举放榜：${results.join('、')}；赋闲${idled}人。`
    : `科举放榜：${idled}名进士暂时赋闲。`;
  addHistory(desc, 'good');
  showToast(`科举完成：授职${appointed}人，赋闲${idled}人`, 'info');
  renderOfficialList();
}

// ===================================================
//  朝堂总览
// ===================================================
function openCourtOverview(){
  G.courtOverviewFilter = 'all';
  document.querySelectorAll('.cof-btn').forEach(b=>b.classList.remove('active'));
  const allBtn = document.querySelector('.cof-btn');
  if(allBtn) allBtn.classList.add('active');
  renderCourtOverview();
  document.getElementById('court-overview-modal').classList.add('show');
  document.addEventListener('keydown', _courtOverviewEsc);
}
function _courtOverviewEsc(e){ if(e.key==='Escape') closeCourtOverview(); }
function closeCourtOverview(){
  document.getElementById('court-overview-modal').classList.remove('show');
  document.removeEventListener('keydown', _courtOverviewEsc);
}
function filterCourtOverview(type, el){
  G.courtOverviewFilter = type;
  document.querySelectorAll('.cof-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderCourtOverview();
}
function renderCourtOverview(){
  const body = document.getElementById('court-overview-body');
  if(!body) return;
  const f = G.courtOverviewFilter;
  let people = [];
  if(f==='all'||f==='court') people.push(...COURT_OFFICIALS.map(o=>({...o,_group:'court'})));
  if(f==='all'||f==='civil') people.push(...CIVIL_OFFICIALS.map(o=>({...o,_group:'civil'})));
  if(f==='all'||f==='military') people.push(...MILITARY_OFFICIALS.map(o=>({...o,_group:'military'})));
  if(f==='all'||f==='idle') people.push(...G.idleScholars.map(o=>({...o,_group:'idle'})));

  if(people.length===0){
    body.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);font-size:12px">暂无人员</div>';
    return;
  }

  body.innerHTML = people.map(o=>{
    const isKing = o.id==='qian_hongchu';
    const isIdle = o._group==='idle';
    const loyaltyColor = o.loyalty>=80?'#2ecc71':o.loyalty>=60?'#e8c97a':'#e74c3c';
    const age = o.age ? (o.age + G.turn - 1) : '?';
    const groupLabel = {court:'重臣',civil:'州官',military:'将领',idle:'赋闲'}[o._group]||'';
    const groupColor = {court:'#c9a84c',civil:'#3498db',military:'#e74c3c',idle:'#888'}[o._group]||'#888';

    const rightBlock = isIdle
      ? `<div class="cov-right">
           <div class="cov-idle-badge">赋闲</div>
           <button class="cov-idle-activate" onclick="activateIdleScholar('${o.id}',event)">启用任官</button>
         </div>`
      : `<div class="cov-right">
           <div class="cov-loyalty" style="color:${isKing?'var(--gold)':loyaltyColor}">${isKing?'国主':('忠'+o.loyalty)}</div>
           <div class="cov-ability">能力 ${o.ability}</div>
         </div>`;

    return `<div class="cov-card${isIdle?' idle-card':''}" onclick="openOfficialModal('${o.id}')">
      <div class="cov-avatar" style="background:linear-gradient(135deg,${o.color}88,${o.color}44)">${o.emoji}</div>
      <div class="cov-info">
        <div class="cov-name">${o.name} <span style="font-size:9px;color:${groupColor};margin-left:3px">${groupLabel}</span></div>
        <div class="cov-role">${o.role}</div>
        <div style="font-size:9px;color:var(--text-muted)">${age}岁 · ${o.skill||''}</div>
      </div>
      ${rightBlock}
    </div>`;
  }).join('');
}

function activateIdleScholar(id, event){
  event.stopPropagation();
  const idx = G.idleScholars.findIndex(s=>s.id===id);
  if(idx<0) return;
  const s = G.idleScholars[idx];

  // 获取空缺槽位
  const vacant = getVacantSlots();
  if(vacant.length===0){
    showToast('当前无空缺官职，无法授职', 'warn');
    return;
  }

  // 弹出官职选择对话框
  openIdleActivateModal(s, idx, vacant);
}

// 赋闲士子启用弹窗
function openIdleActivateModal(scholar, idleIdx, vacant){
  // 复用confirm弹窗，但内容改为官职选择
  const el = document.getElementById('confirm-overlay');
  document.getElementById('confirm-title').textContent = `授职：${scholar.name}（${scholar.rank}·专长${scholar.skill}）`;

  const catOrder = {court:0, civil:1, military:2};
  vacant.sort((a,b)=> a.rank-b.rank || catOrder[a.category]-catOrder[b.category]);

  const buildIdleGroup = (cat, label) => {
    const slots = vacant.filter(sl=>sl.category===cat).sort((a,b)=>a.rank-b.rank);
    if(slots.length===0) return '';
    const opts = slots.map(slot=>{
      const matchMark = slot.skillPref.includes(scholar.skill) ? '★' : '　';
      const rankStr = RANK_LABEL[slot.rank]||`${slot.rank}品`;
      return `<option value="${slot.id}">${matchMark} [${rankStr}] ${slot.title}</option>`;
    }).join('');
    return `<optgroup label="── ${label} ──">${opts}</optgroup>`;
  };
  const options = buildIdleGroup('court','朝廷') + buildIdleGroup('civil','州郡') + buildIdleGroup('military','军队');

  document.getElementById('confirm-msg').innerHTML =
    `<div style="margin-bottom:8px;font-size:11px;color:var(--text-muted)">请为 ${scholar.name} 选择授职官职：</div>
     <select id="idle-slot-select" style="width:100%;padding:6px 8px;font-size:12px;background:var(--bg-panel);border:1px solid var(--border);color:var(--text);border-radius:4px;font-family:inherit;outline:none;">
       ${options}
     </select>
     <div id="idle-slot-desc" style="margin-top:6px;font-size:10px;color:var(--gold-light);padding:4px 8px;background:rgba(201,168,76,0.06);border-left:2px solid var(--gold-dim);border-radius:0 3px 3px 0;min-height:18px"></div>`;

  // 选择时更新说明
  setTimeout(()=>{
    const sel = document.getElementById('idle-slot-select');
    const desc = document.getElementById('idle-slot-desc');
    const updateDesc = ()=>{
      const slot = OFFICE_ROSTER.find(s=>s.id===sel.value);
      desc.textContent = slot ? `${slot.emoji} ${slot.desc}` : '';
    };
    if(sel){ sel.addEventListener('change', updateDesc); updateDesc(); }
  }, 50);

  document.getElementById('confirm-ok-btn').textContent = '确认授职';
  document.getElementById('confirm-ok-btn').onclick = ()=>{
    el.classList.remove('show');
    document.getElementById('confirm-ok-btn').textContent = '确认';
    const sel = document.getElementById('idle-slot-select');
    if(!sel||!sel.value) return;
    const slotId = sel.value;
    appointToSlot(scholar, slotId);
    G.idleScholars.splice(idleIdx, 1);
    const slot = OFFICE_ROSTER.find(s=>s.id===slotId);
    applyEffects({culture:+3, stability:+1});
    addHistory(`${scholar.name}由赋闲授职${slot?slot.title:'官职'}`, 'good');
    showToast(`${scholar.name}已授职${slot?slot.title:''}`, 'info');
    renderCourtOverview();
    renderOfficialList();
  };
  document.getElementById('confirm-cancel-btn').onclick = ()=>{
    el.classList.remove('show');
    document.getElementById('confirm-ok-btn').textContent = '确认';
  };
  el.classList.add('show');
}

// ===================================================
//  战争威胁系统
// ===================================================
const WAR_THREATS = [
  { id:'wt_tang', name:'南唐入侵', enemy:'南唐', icon:'⚔️',
    condition: s=>s.military<40||s.diplomacy<30,
    desc:'南唐趁吴越军力衰弱，陈兵边境，大有入侵之势。',
    choices:[
      { label:'【积极备战】', text:'调兵遣将，加强边防', effect:{military:+15,treasury:-15,people:-5}, result:{icon:'🛡️',title:'边境稳固',desc:'吴越积极备战，南唐见状不敢轻举妄动，边境暂时平静。',type:'good'} },
      { label:'【外交斡旋】', text:'遣使议和，以财帛换和平', effect:{diplomacy:+10,treasury:-20,prestige:-5}, result:{icon:'🏮',title:'暂时议和',desc:'以重金换来南唐暂时退兵，但此举令天下人耻笑，声望受损。',type:'neutral'} },
      { label:'【坚壁清野】', text:'收缩防线，固守城池', effect:{defense:+10,people:-8,commerce:-5}, result:{icon:'🏯',title:'固守待援',desc:'吴越坚壁清野，南唐久攻不下，最终退兵。但边境百姓损失惨重。',type:'neutral'} },
    ]
  },
  { id:'wt_zhou', name:'后周南下', enemy:'后周', icon:'🔥',
    condition: s=>s.military<35||s.prestige<30,
    desc:'后周皇帝意图统一天下，大军南下，吴越首当其冲。',
    choices:[
      { label:'【称臣纳贡】', text:'主动称臣，以换取和平', effect:{diplomacy:+15,prestige:-20,treasury:-25}, result:{icon:'📜',title:'保境安民',desc:'吴越称臣后周，虽失颜面，但保住了百姓安宁。此乃钱氏一贯之策。',type:'neutral'} },
      { label:'【联合南唐】', text:'与南唐结盟共抗后周', effect:{diplomacy:-5,military:+10,stability:-5}, result:{icon:'🤝',title:'合纵抗周',desc:'吴越与南唐暂时结盟，后周顾虑两面受敌，暂缓南下。但联盟并不稳固。',type:'neutral'} },
      { label:'【死守城池】', text:'全力备战，誓死抵抗', effect:{military:+5,people:-15,treasury:-20}, result:{icon:'💀',title:'惨烈抵抗',desc:'吴越军民奋勇抵抗，后周损失惨重，最终撤军。但吴越也元气大伤。',type:'bad'} },
    ]
  },
  { id:'wt_pirates', name:'海盗猖獗', enemy:'海盗', icon:'🏴‍☠️',
    condition: s=>s.military<45&&s.commerce>40,
    desc:'东海海盗趁吴越水师薄弱，大肆劫掠沿海商船，明州港口几乎瘫痪。',
    choices:[
      { label:'【水师清剿】', text:'出动水师，剿灭海盗', effect:{military:-5,treasury:-10,commerce:+15}, result:{icon:'⚓',title:'海疆清平',desc:'吴越水师奋勇出击，大破海盗巢穴，东海商路重新畅通。',type:'good'} },
      { label:'【招安收编】', text:'招安海盗，为我所用', effect:{military:+10,diplomacy:-5,people:-3}, result:{icon:'🏴‍☠️',title:'化敌为友',desc:'部分海盗接受招安，编入水师。虽有争议，但确实增强了海上力量。',type:'neutral'} },
      { label:'【封锁港口】', text:'暂时封港，等待时机', effect:{commerce:-15,treasury:-8,people:-5}, result:{icon:'🚫',title:'商路受阻',desc:'封港虽暂时减少了损失，但商业大受打击，百姓怨声载道。',type:'bad'} },
    ]
  },
];

// 危机事件池（比普通事件更严重，有时间压力）
const CRISIS_EVENTS = [
  { id:'crisis_famine', name:'大饥荒', icon:'🌾', tag:'crisis',
    condition: s=>s.grain<100||s.agri<30,
    scene:'连年旱涝，粮食歉收，各地百姓饥寒交迫，已有流民四起之象。',
    desc:'粮食储备告急，若不及时赈济，恐有民变之虞。',
    choices:[
      { label:'【开仓赈济】', text:'动用国库粮食，全力赈灾', effect:{grain:+80,people:+15,treasury:-20,stability:+5}, result:{icon:'🌾',title:'饥荒平息',desc:'大王开仓放粮，百姓感激涕零，饥荒得以平息，民心大振。',type:'good'} },
      { label:'【向外购粮】', text:'高价从外国购入粮食', effect:{grain:+60,treasury:-30,diplomacy:+5}, result:{icon:'💰',title:'购粮救急',desc:'虽花费不菲，但及时购入粮食，解了燃眉之急。',type:'neutral'} },
      { label:'【强制征粮】', text:'向富户强制征粮', effect:{grain:+50,people:-20,stability:-10,commerce:-8}, result:{icon:'😤',title:'民怨四起',desc:'强制征粮虽解了粮荒，但引发富户不满，民间怨声载道。',type:'bad'} },
    ]
  },
  { id:'crisis_flood', name:'钱塘大潮', icon:'🌊', tag:'crisis',
    condition: s=>s.agri<50||Math.random()<0.08,
    scene:'钱塘江大潮异常凶猛，海塘多处决口，杭州城外一片汪洋，农田尽毁。',
    desc:'海塘决口，需紧急调拨资金修缮，否则来年农业将大受影响。',
    choices:[
      { label:'【紧急修缮】', text:'调拨重金，立即修缮海塘', effect:{treasury:-25,agri:+15,people:+10,stability:+5}, result:{icon:'🏗️',title:'海塘修复',desc:'大王亲自督工，海塘迅速修复，百姓对大王的勤政深感敬佩。',type:'good'} },
      { label:'【征发民夫】', text:'征发百姓服役修缮', effect:{agri:+10,people:-12,treasury:-8}, result:{icon:'⚒️',title:'民夫修堤',desc:'海塘修复，但大量征发民夫影响了农业生产，百姓颇有怨言。',type:'neutral'} },
      { label:'【暂缓修缮】', text:'财力不足，暂缓处理', effect:{agri:-15,people:-8,stability:-8}, result:{icon:'💧',title:'水患蔓延',desc:'未能及时修缮，水患持续蔓延，农业损失惨重，百姓苦不堪言。',type:'bad'} },
    ]
  },
  { id:'crisis_rebellion', name:'地方叛乱', icon:'🔥', tag:'crisis',
    condition: s=>s.people<35||s.stability<30,
    scene:'某地刺史趁民心不稳，煽动叛乱，自立为王，已聚众数千，声势浩大。',
    desc:'叛乱若不及时平定，将动摇吴越根基。',
    choices:[
      { label:'【武力镇压】', text:'调兵遣将，武力平叛', effect:{military:-8,treasury:-15,stability:+15,people:-5}, result:{icon:'⚔️',title:'叛乱平定',desc:'吴越军队迅速平叛，叛首伏诛，但战事造成了一定损失。',type:'neutral'} },
      { label:'【招抚安民】', text:'派遣使者，招抚叛军', effect:{people:+10,stability:+8,prestige:-5,treasury:-10}, result:{icon:'🕊️',title:'招抚成功',desc:'大王以仁义招抚，叛军首领感念恩德，率众归降，兵不血刃平定叛乱。',type:'good'} },
      { label:'【坐视不理】', text:'暂时观望，等待时机', effect:{stability:-15,people:-10,prestige:-10}, result:{icon:'😱',title:'叛乱蔓延',desc:'坐视不理导致叛乱蔓延，更多地方响应，局势愈发危急。',type:'bad'} },
    ]
  },
  { id:'crisis_plague', name:'瘟疫肆虐', icon:'☠️', tag:'crisis',
    condition: s=>s.people<60||Math.random()<0.06,
    scene:'江南水乡爆发瘟疫，已有数万人染病，死亡者众，百姓人心惶惶。',
    desc:'瘟疫若不控制，将造成大量人口死亡，动摇国本。',
    choices:[
      { label:'【广施医药】', text:'调拨国库，广请名医施药', effect:{treasury:-20,people:+12,population:-5,stability:+5}, result:{icon:'💊',title:'疫情控制',desc:'大王广施医药，疫情得到控制，百姓感念大王仁德。',type:'good'} },
      { label:'【隔离封锁】', text:'封锁疫区，防止蔓延', effect:{people:-8,population:-10,commerce:-10,stability:+3}, result:{icon:'🚧',title:'疫情隔离',desc:'封锁措施有效阻止了疫情蔓延，但封锁区百姓损失惨重。',type:'neutral'} },
      { label:'【祈天禳灾】', text:'举行大型祭祀，祈求上天庇佑', effect:{people:+5,culture:+3,treasury:-8,population:-15}, result:{icon:'🛕',title:'祭祀无效',desc:'祭祀并未能阻止疫情，瘟疫继续蔓延，人口大量减少。',type:'bad'} },
    ]
  },
  { id:'crisis_treasury', name:'财政危机', icon:'💸', tag:'crisis',
    condition: s=>s.treasury<15,
    scene:'国库几近告罄，官员俸禄无法发放，军队粮饷拖欠，各地怨声载道。',
    desc:'财政危机若不解决，军队可能哗变，官员可能叛离。',
    choices:[
      { label:'【紧急借贷】', text:'向富商借贷，解燃眉之急', effect:{treasury:+30,commerce:-10,stability:-5,people:-3}, result:{icon:'💰',title:'暂渡难关',desc:'借贷解了燃眉之急，但高额利息将成为长期负担。',type:'neutral'} },
      { label:'【变卖资产】', text:'变卖宫廷珍宝，充实国库', effect:{treasury:+25,prestige:-10,people:+5}, result:{icon:'💎',title:'节俭示范',desc:'大王以身作则，变卖珍宝，百姓感念大王节俭，民心稍安。',type:'neutral'} },
      { label:'【加征赋税】', text:'紧急加税，充实国库', effect:{treasury:+20,people:-20,stability:-10,commerce:-5}, result:{icon:'😤',title:'民怨沸腾',desc:'紧急加税引发民怨，百姓苦不堪言，稳定局势大受影响。',type:'bad'} },
    ]
  },
];

// 检查并触发危机事件
function checkCrisisEvents(){
  for(const crisis of CRISIS_EVENTS){
    if(!G.usedEventIds.has(crisis.id) && crisis.condition(G.stats)){
      // 30%概率触发（避免每年都触发）
      if(Math.random()<0.35){
        G.usedEventIds.add(crisis.id);
        // 危机事件加入年度事件队列最前面
        G.yearEvents.unshift({...crisis, isCrisis:true});
        addHistory(`⚠️ 危机：${crisis.name}`, 'bad');
        showToast(`⚠️ 危机事件：${crisis.name}！`, 'warn');
        return;
      }
    }
  }
  // 检查战争威胁
  checkWarThreats();
}

function checkWarThreats(){
  for(const wt of WAR_THREATS){
    if(!G.usedEventIds.has(wt.id) && wt.condition(G.stats)){
      if(Math.random()<0.25){
        G.usedEventIds.add(wt.id);
        G.yearEvents.unshift({
          id: wt.id,
          tag: 'war', tagText: '战事',
          title: wt.name,
          scene: wt.desc,
          desc: `${wt.enemy}威胁迫在眉睫，大王须立即决断！`,
          choices: wt.choices,
          isWar: true,
        });
        addHistory(`⚔️ 战争威胁：${wt.name}`, 'bad');
        showToast(`⚔️ 战争威胁：${wt.name}！`, 'warn');
        return;
      }
    }
  }
}

// 官员忠诚度危机：低忠诚度官员可能叛变
function checkOfficialLoyalty(){
  const allOff = [...COURT_OFFICIALS, ...CIVIL_OFFICIALS, ...MILITARY_OFFICIALS];
  const traitors = allOff.filter(o=>o.id!=='qian_hongchu' && o.loyalty<30);
  if(traitors.length>0 && Math.random()<0.4){
    const traitor = traitors[Math.floor(Math.random()*traitors.length)];
    G.yearEvents.unshift({
      id: `loyalty_${traitor.id}`,
      tag: 'politics', tagText: '政变',
      title: `${traitor.name}心生异志`,
      scene: `${traitor.role}${traitor.name}忠诚度极低，近日行为异常，有人密报其与外国有所往来，恐有叛变之虞。`,
      desc: `${traitor.name}（忠诚度：${traitor.loyalty}）可能叛变，须立即处置。`,
      choices:[
        { label:'【安抚拉拢】', text:'赏赐厚礼，安抚其心', effect:{treasury:-15,stability:+5}, result:{icon:'🎁',title:'暂时安抚',desc:`${traitor.name}接受赏赐，暂时安分，但其忠心仍需观察。`,type:'neutral'}, onConfirm:()=>{ traitor.loyalty=Math.min(100,traitor.loyalty+25); } },
        { label:'【秘密监视】', text:'暗中监视，收集证据', effect:{stability:+3,culture:+2}, result:{icon:'🔍',title:'掌握把柄',desc:`通过监视掌握了${traitor.name}的把柄，其再不敢轻举妄动。`,type:'good'}, onConfirm:()=>{ traitor.loyalty=Math.min(100,traitor.loyalty+15); } },
        { label:'【革职查办】', text:'立即革职，投入大牢', effect:{stability:-5,people:-3,military:traitor._group==='military'?-8:0}, result:{icon:'⛓️',title:'革职查办',desc:`${traitor.name}被革职查办，朝廷震慑，但也引发了一些官员的不安。`,type:'neutral'}, onConfirm:()=>{ removeOfficial(traitor.id); } },
      ]
    });
    showToast(`⚠️ 官员异动：${traitor.name}忠诚度过低！`, 'warn');
  }
}

function removeOfficial(id){
  const removeFrom = arr=>{
    const idx=arr.findIndex(o=>o.id===id);
    if(idx>=0) arr.splice(idx,1);
  };
  removeFrom(COURT_OFFICIALS);
  removeFrom(CIVIL_OFFICIALS);
  removeFrom(MILITARY_OFFICIALS);
  renderOfficialList();
}

// 年度随机特殊事件（增加更多趣味性）
const ANNUAL_SPECIAL_EVENTS = [
  { id:'ase_tribute', name:'藩属来朝', icon:'🏮',
    condition: s=>s.prestige>60&&s.diplomacy>50,
    scene:'周边小国遣使来朝，献上珍宝，请求吴越庇护。',
    choices:[
      { label:'【接受朝贡】', text:'接受朝贡，给予庇护', effect:{prestige:+10,diplomacy:+8,treasury:+15}, result:{icon:'👑',title:'四方来朝',desc:'吴越声威大振，周边小国纷纷来朝，天下皆知吴越之强盛。',type:'good'} },
      { label:'【婉言谢绝】', text:'婉言谢绝，不愿树敌', effect:{diplomacy:+3,prestige:-3}, result:{icon:'🤝',title:'保持中立',desc:'吴越婉拒朝贡，保持低调，避免引起大国注意。',type:'neutral'} },
    ]
  },
  { id:'ase_talent', name:'天下名士来投', icon:'📚',
    condition: s=>s.culture>55&&s.prestige>45,
    scene:'吴越文风鼎盛，天下名士慕名而来，其中不乏经世之才。',
    choices:[
      { label:'【厚礼相待】', text:'以高官厚禄相待，留其效力', effect:{culture:+8,treasury:-10,stability:+5}, result:{icon:'🎓',title:'人才汇聚',desc:'名士留吴越效力，带来了先进的治国理念，吴越文治大进。',type:'good'} },
      { label:'【以礼相待】', text:'以礼相待，量才录用', effect:{culture:+5,treasury:-5}, result:{icon:'📜',title:'人才录用',desc:'名士受到礼遇，部分留下效力，吴越文治稳步提升。',type:'neutral'} },
    ]
  },
  { id:'ase_drought', name:'大旱之年', icon:'☀️',
    condition: s=>Math.random()<0.12,
    scene:'今年大旱，各地河流干涸，农田龟裂，粮食减产严重。',
    choices:[
      { label:'【兴修水利】', text:'紧急兴修水利，抗旱救灾', effect:{treasury:-18,agri:+8,people:+5,grain:-30}, result:{icon:'💧',title:'抗旱有方',desc:'大王亲自督导抗旱，兴修水利，虽损失不小，但保住了大部分收成。',type:'neutral'} },
      { label:'【祈雨祭天】', text:'举行祈雨仪式，安抚民心', effect:{people:+3,culture:+2,grain:-50,agri:-5}, result:{icon:'🌧️',title:'天降甘霖',desc:'祈雨仪式后恰逢降雨，百姓以为大王感动上天，民心大振。（实为巧合）',type:'neutral'} },
      { label:'【开仓赈济】', text:'开仓放粮，赈济灾民', effect:{grain:-60,people:+12,stability:+5,treasury:-5}, result:{icon:'🌾',title:'赈灾得力',desc:'及时开仓赈济，百姓度过难关，对大王感恩戴德。',type:'good'} },
    ]
  },
  { id:'ase_trade', name:'海上贸易大兴', icon:'⛵',
    condition: s=>s.commerce>45&&s.diplomacy>40,
    scene:'明州港口商船云集，大食、新罗、日本商人纷至沓来，贸易额创历史新高。',
    choices:[
      { label:'【大力扶持】', text:'减免关税，大力扶持海贸', effect:{commerce:+15,treasury:+20,diplomacy:+8,people:+5}, result:{icon:'⛵',title:'海贸大兴',desc:'吴越海上贸易蓬勃发展，财富滚滚而来，百姓生活大为改善。',type:'good'} },
      { label:'【征收重税】', text:'趁机征收重税，充实国库', effect:{commerce:-8,treasury:+30,diplomacy:-5}, result:{icon:'💰',title:'短期获利',desc:'重税虽充实了国库，但商人怨声载道，长远来看不利于贸易发展。',type:'neutral'} },
    ]
  },
  { id:'ase_spy', name:'发现奸细', icon:'🕵️',
    condition: s=>s.diplomacy<50||Math.random()<0.08,
    scene:'御史台密报，朝中发现疑似外国奸细，已渗透至要害部门，情报可能外泄。',
    choices:[
      { label:'【秘密清查】', text:'秘密清查，不动声色', effect:{stability:+5,military:+3,diplomacy:-3}, result:{icon:'🔍',title:'奸细伏法',desc:'经秘密调查，奸细被一网打尽，情报安全得到保障。',type:'good'} },
      { label:'【大张旗鼓】', text:'公开审查，杀鸡儆猴', effect:{stability:-5,people:-3,prestige:+5,diplomacy:-8}, result:{icon:'⚖️',title:'震慑宵小',desc:'公开审查虽引发一定恐慌，但有效震慑了潜在的奸细。',type:'neutral'} },
    ]
  },
];

// 检查年度特殊事件
function checkAnnualSpecialEvents(){
  for(const ase of ANNUAL_SPECIAL_EVENTS){
    if(!G.usedEventIds.has(ase.id) && ase.condition(G.stats)){
      if(Math.random()<0.4){
        G.usedEventIds.add(ase.id);
        G.yearEvents.push({
          id: ase.id,
          tag: 'special', tagText: '特事',
          title: ase.name,
          scene: ase.scene,
          desc: '',
          choices: ase.choices,
        });
      }
    }
  }
}

// ===================================================
//  A项：税率系统 - 民变事件
// ===================================================
function _triggerRebellionEvent(){
  if(G.yearEvents.find(e=>e.id==='rebellion_event')) return; // 避免重复
  G.yearEvents.unshift({
    id: 'rebellion_event',
    tag: 'urgent', tagText: '民变',
    title: '饥民揭竿而起',
    scene: `苛政之下，民不聊生。${G.taxRate==='harsh'?'苛政重税，':'高额赋税，'}各地饥民聚众，已有数千人冲击官府，局势危急！`,
    desc: `民心已降至${G.stats.people}，百姓忍无可忍。若不立即处置，恐成大乱。`,
    choices:[
      { label:'【立即减税】', text:'宣布减税，开仓放粮，安抚民心', cost:20,
        effect:{ people:+15, stability:+8, grain:-40 },
        result:{ icon:'🌾', title:'民心稍安', desc:'大王宣布减税，开仓放粮，饥民渐渐散去。民心有所回升，但积怨仍深，需持续改善。', type:'good' },
        onConfirm:()=>{ G.taxRate='normal'; }
      },
      { label:'【出兵镇压】', text:'调兵镇压，强行平息民变', cost:0,
        effect:{ people:-10, stability:-8, military:-5, prestige:-8 },
        result:{ icon:'⚔️', title:'强行镇压', desc:'军队镇压了民变，但死伤惨重，民间怨恨更深。此举治标不治本，日后恐有更大动乱。', type:'bad' }
      },
      { label:'【招抚首领】', text:'派人招抚民变首领，许以官职，分化瓦解', cost:10,
        effect:{ people:+5, stability:+3, diplomacy:+2 },
        result:{ icon:'🤝', title:'招抚得当', desc:'民变首领被招抚，大部分饥民散去。虽未根本解决问题，但暂时稳住了局势。', type:'neutral' }
      },
    ]
  });
  addHistory('⚠️ 民变爆发！饥民聚众冲击官府！', 'bad');
  showToast('⚠️ 民变爆发！请立即处置！', 'warn');
}

// 税率调整行动（在内政系统里调用）
function setTaxRate(rate){
  if(!TAX_RATE_CONFIG[rate]) return;
  const old = TAX_RATE_CONFIG[G.taxRate];
  const newCfg = TAX_RATE_CONFIG[rate];
  G.taxRate = rate;
  addHistory(`调整税率：${old.label} → ${newCfg.label}。${newCfg.desc}`, rate==='low'?'good':rate==='normal'?'neutral':'bad');
  showToast(`税率已调整为：${newCfg.label}`, rate==='low'||rate==='normal'?'info':'warn');
  updateStats();
  renderSysDetail(G.currentSystem);
}

// ===================================================
//  B项：官职空缺系统
// ===================================================
// 各类官职空缺的年度惩罚
const OFFICE_VACANCY_PENALTY = {
  court:    { stability:-3, culture:-2 },
  civil:    { people:-3, agri:-2 },
  military: { military:-4, defense:-2 },
};

function _recordVacancy(officialId, role, group){
  if(!(G.vacantOffices||[]).find(v=>v.id===officialId)){
    G.vacantOffices = G.vacantOffices || [];
    G.vacantOffices.push({ id: officialId, role, group, since: G.turn });
    addHistory(`⚠️ ${role}出现空缺，需尽快选拔新官。`, 'bad');
    showToast(`⚠️ ${role}空缺！`, 'warn');
    // 将选拔事件加入事件队列
    _pushRecruitEvent(officialId, role, group);
  }
}

function _pushRecruitEvent(vacId, role, group){
  const candidates = _generateCandidates(group);
  G.yearEvents.push({
    id: `recruit_${vacId}`,
    tag: 'politics', tagText: '选拔',
    title: `选拔新任${role}`,
    scene: `${role}一职出现空缺，朝廷需尽快选拔贤才补缺，以免政务荒废。`,
    desc: `请从以下候选人中选拔一位担任${role}：`,
    choices: candidates.map(c=>({
      label: `【${c.name}】${c.trait}·能力${c.ability}`,
      text: `任命${c.name}为${role}，${c.bio}`,
      effect: c.effect,
      result: { icon:'📜', title:`${c.name}走马上任`, desc:`${c.name}接受任命，出任${role}。${c.bio}`, type:'good' },
      onConfirm: ()=>{ _appointNewOfficial(c, role, group, vacId); }
    }))
  });
}

function _generateCandidates(group){
  const pools = {
    court:    [['张文远','博学','精通文治礼制',{culture:+5,stability:+3}],['李守正','刚直','执法严明，不畏权贵',{stability:+5,people:+2}],['王德昭','圆融','善于协调各方关系',{diplomacy:+4,stability:+2}]],
    civil:    [['陈民安','务实','长于农政水利',{agri:+5,people:+3}],['刘丰年','勤勉','治理地方有方',{people:+4,stability:+2}],['赵惠民','仁厚','深得百姓爱戴',{people:+6,stability:+1}]],
    military: [['韩猛将','勇猛','骁勇善战，屡立战功',{military:+5,defense:+2}],['周守备','谨慎','善于防守，稳重可靠',{defense:+5,military:+2}],['吴先锋','果断','进攻犀利，士气高昂',{military:+6,people:-1}]],
  };
  return (pools[group]||pools.court).map(([name,trait,bio,effect])=>({
    name, trait, bio, effect,
    ability: 60 + Math.floor(Math.random()*25),
    id: `recruit_${name}_${Date.now()}`
  }));
}

function _appointNewOfficial(candidate, role, group, vacId){
  const newOff = {
    id: candidate.id,
    name: candidate.name,
    role,
    emoji: group==='military'?'⚔️':group==='civil'?'🏛️':'📜',
    color: '#c9a84c',
    age: 25 + Math.floor(Math.random()*20),
    loyalty: 70 + Math.floor(Math.random()*20),
    ability: candidate.ability,
    skill: group==='military'?'军事':group==='civil'?'内政':'文治',
    trait: candidate.trait,
    bio: candidate.bio,
  };
  const arr = group==='court'?COURT_OFFICIALS:group==='civil'?CIVIL_OFFICIALS:MILITARY_OFFICIALS;
  arr.push(newOff);
  G.vacantOffices = (G.vacantOffices||[]).filter(v=>v.id!==vacId);
  addHistory(`✅ ${candidate.name}出任${role}，空缺已补。`, 'good');
  renderOfficialList();
}

// ===================================================
//  D项：邻国使者系统
// ===================================================
const ENVOY_TEMPLATES = [
  {
    id:'envoy_alliance', nationId:'nantang', type:'alliance',
    condition: n=>n.relation>=40 && n.relation<70,
    title: s=>`${s.name}遣使求盟`,
    scene: s=>`${s.emoji}${s.name}使者抵达杭州，带来国书，提议两国结为盟友，共抗后周压力。`,
    choices: n=>[
      { label:'【欣然结盟】', text:'接受结盟，互派使节，共同应对后周', effect:{diplomacy:+12,prestige:+5,military:+3},
        result:{icon:'🤝',title:'吴越南唐结盟',desc:`吴越与${n.name}正式结盟，两国互派使节，共同应对外部压力。外交格局大为改善。`,type:'good'},
        onConfirm:()=>{ const nat=NATIONS.find(x=>x.id===n.id); if(nat){nat.relation=Math.min(100,nat.relation+20);nat.status='ally';nat.statusText='盟友';} }
      },
      { label:'【婉言谢绝】', text:'以需从长计议为由，婉拒结盟', effect:{diplomacy:-3},
        result:{icon:'📜',title:'婉拒结盟',desc:`吴越婉拒了${n.name}的结盟提议，双方关系略有降温，但未破裂。`,type:'neutral'}
      },
      { label:'【索取好处】', text:'趁机要求对方割让土地或岁贡方可结盟', effect:{diplomacy:-8,treasury:+20,prestige:+3},
        result:{icon:'💰',title:'漫天要价',desc:`${n.name}使者愤而离去，结盟未成，但吴越的强硬姿态令对方有所忌惮。`,type:'neutral'}
      },
    ]
  },
  {
    id:'envoy_trade', nationId:'min', type:'trade',
    condition: n=>n.relation>=30,
    title: s=>`${s.name}请求通商`,
    scene: s=>`${s.emoji}${s.name}商人随使者而来，希望开辟两国贸易往来，互通有无。`,
    choices: n=>[
      { label:'【开放通商】', text:'同意开放贸易，互派商队', effect:{commerce:+10,diplomacy:+8,treasury:+15},
        result:{icon:'⛵',title:'通商大兴',desc:`吴越与${n.name}正式开通商路，两国商队往来频繁，财货流通，国库充盈。`,type:'good'},
        onConfirm:()=>{ _openTradeRoute(n.id); }
      },
      { label:'【征收重税】', text:'同意通商，但征收高额关税', effect:{commerce:+3,diplomacy:-3,treasury:+25},
        result:{icon:'💰',title:'重税通商',desc:`通商开启，但高额关税令商人怨声载道，贸易规模受限。`,type:'neutral'},
        onConfirm:()=>{ _openTradeRoute(n.id, 0.6); }
      },
      { label:'【拒绝通商】', text:'以安全为由，拒绝开放贸易', effect:{diplomacy:-5},
        result:{icon:'🚫',title:'拒绝通商',desc:`吴越拒绝了通商请求，${n.name}使者失望而归。`,type:'bad'}
      },
    ]
  },
  {
    id:'envoy_tribute_demand', nationId:'zhou', type:'tribute',
    condition: ()=>true,
    title: ()=>'后周使者催缴岁贡',
    scene: ()=>'后周使者持天子诏书抵达，要求吴越按时缴纳岁贡，并增加军粮供应。',
    choices: ()=>[
      { label:'【慷慨应允】', text:'全额缴纳，表示忠心', effect:{diplomacy:+8,treasury:-25,prestige:-3},
        result:{icon:'🏮',title:'宗主满意',desc:'后周天子满意，赐予吴越更高封号，两国关系稳固。',type:'neutral'}
      },
      { label:'【讨价还价】', text:'缴纳部分，以灾情为由请求减免', effect:{diplomacy:+3,treasury:-12},
        result:{icon:'🤝',title:'折中处置',desc:'后周接受了部分岁贡，双方关系维持稳定。',type:'good'}
      },
      { label:'【拖延推诿】', text:'以国内困难为由，请求延期缴纳', effect:{diplomacy:-8,prestige:-5},
        result:{icon:'⚠️',title:'关系紧张',desc:'后周使者不满而归，两国关系趋于紧张，需尽快修复。',type:'bad'}
      },
    ]
  },
  {
    id:'envoy_peace', nationId:'nantang', type:'peace',
    condition: n=>n.status==='hostile',
    title: s=>`${s.name}遣使求和`,
    scene: s=>`战事连绵，${s.emoji}${s.name}主动遣使求和，希望两国罢兵言和，恢复邦交。`,
    choices: n=>[
      { label:'【接受议和】', text:'接受求和，双方停战，恢复邦交', effect:{diplomacy:+10,prestige:+5,people:+5},
        result:{icon:'🕊️',title:'两国议和',desc:`吴越与${n.name}正式议和，边境恢复平静，百姓得以休养生息。`,type:'good'},
        onConfirm:()=>{ const nat=NATIONS.find(x=>x.id===n.id); if(nat){nat.relation=Math.min(100,nat.relation+25);nat.status='neutral';nat.statusText='中立';} }
      },
      { label:'【趁势索赔】', text:'接受议和，但要求对方赔偿损失', effect:{diplomacy:+3,treasury:+20,prestige:+8},
        result:{icon:'💰',title:'索赔议和',desc:`${n.name}支付了赔偿，双方议和。吴越声望有所提升。`,type:'good'},
        onConfirm:()=>{ const nat=NATIONS.find(x=>x.id===n.id); if(nat){nat.relation=Math.min(100,nat.relation+10);nat.status='neutral';nat.statusText='中立';} }
      },
      { label:'【拒绝议和】', text:'拒绝求和，继续施压', effect:{diplomacy:-5,military:+3,prestige:+3},
        result:{icon:'⚔️',title:'拒绝议和',desc:`吴越拒绝了${n.name}的求和，继续保持强硬姿态。`,type:'neutral'}
      },
    ]
  },
];

function _generateEnvoyEvents(){
  // 每年有40%概率生成一个使者事件
  if(Math.random() > 0.40) return;
  // 随机选一个满足条件的模板
  const eligible = ENVOY_TEMPLATES.filter(t=>{
    const nation = NATIONS.find(n=>n.id===t.nationId);
    if(!nation) return false;
    return t.condition(nation);
  });
  if(eligible.length === 0) return;
  const tmpl = eligible[Math.floor(Math.random()*eligible.length)];
  const nation = NATIONS.find(n=>n.id===tmpl.nationId);
  if(!nation) return;
  // 避免同类型使者重复
  if(G.yearEvents.find(e=>e.id===`envoy_${tmpl.id}`)) return;

  G.yearEvents.push({
    id: `envoy_${tmpl.id}_${G.turn}`,
    tag: 'diplomacy', tagText: '外交',
    title: tmpl.title(nation),
    scene: tmpl.scene(nation),
    desc: '',
    choices: tmpl.choices(nation),
  });
  addHistory(`🏮 外交：${tmpl.title(nation)}`, 'neutral');
  showToast(`🏮 ${tmpl.title(nation)}`, 'info');
}

// ===================================================
//  E项：自然灾害系统
// ===================================================
const DISASTER_TYPES = [
  {
    id:'flood', name:'洪涝灾害', icon:'🌊', weight:20,
    condition: s=>s.agri<70 || Math.random()<0.08,
    severity: ()=>Math.random()<0.3?'severe':'moderate',
    effect: (sev)=>sev==='severe'
      ? { grain:-80, people:-12, agri:-8, stability:-5 }
      : { grain:-40, people:-6, agri:-4 },
    reliefCost: (sev)=>sev==='severe'?25:12,
    scene: (pref)=>`${pref}一带连日暴雨，江河决堤，大片农田被淹，数万百姓流离失所。`,
  },
  {
    id:'drought', name:'旱灾', icon:'☀️', weight:20,
    condition: s=>Math.random()<0.10,
    severity: ()=>Math.random()<0.25?'severe':'moderate',
    effect: (sev)=>sev==='severe'
      ? { grain:-100, people:-15, agri:-10, stability:-6 }
      : { grain:-50, people:-8, agri:-5 },
    reliefCost: (sev)=>sev==='severe'?30:15,
    scene: (pref)=>`${pref}大旱，河流干涸，庄稼颗粒无收，百姓嗷嗷待哺。`,
  },
  {
    id:'locust', name:'蝗灾', icon:'🦗', weight:15,
    condition: s=>s.agri<65 || Math.random()<0.06,
    severity: ()=>Math.random()<0.2?'severe':'moderate',
    effect: (sev)=>sev==='severe'
      ? { grain:-90, people:-10, agri:-12, commerce:-5 }
      : { grain:-45, people:-5, agri:-6 },
    reliefCost: (sev)=>sev==='severe'?20:10,
    scene: (pref)=>`${pref}遮天蔽日的蝗虫铺天盖地而来，所过之处寸草不生，粮食损失惨重。`,
  },
  {
    id:'epidemic', name:'瘟疫', icon:'🤒', weight:12,
    condition: s=>s.people<60 || Math.random()<0.06,
    severity: ()=>Math.random()<0.2?'severe':'moderate',
    effect: (sev)=>sev==='severe'
      ? { people:-18, stability:-8, military:-5, population:-5 }
      : { people:-10, stability:-4, military:-2 },
    reliefCost: (sev)=>sev==='severe'?28:14,
    scene: (pref)=>`${pref}爆发瘟疫，病死者众，百姓人心惶惶，城中已有封街之议。`,
  },
];

function _checkAnnualDisaster(){
  // 已有活跃灾害则不再叠加
  if(G.activeDisaster) return;
  // 约25%概率触发灾害
  if(Math.random() > 0.25) return;

  const totalWeight = DISASTER_TYPES.reduce((s,d)=>s+d.weight,0);
  let r = Math.random()*totalWeight;
  let dtype = DISASTER_TYPES[DISASTER_TYPES.length-1];
  for(const d of DISASTER_TYPES){ r-=d.weight; if(r<=0){dtype=d;break;} }

  if(!dtype.condition(G.stats)) return;

  const sev = dtype.severity();
  const pref = PREFECTURES[Math.floor(Math.random()*PREFECTURES.length)];
  const effect = dtype.effect(sev);
  const reliefCost = dtype.reliefCost(sev);
  const sevLabel = sev==='severe'?'严重':'一般';

  G.activeDisaster = { type:dtype.id, severity:sev, turn:G.turn, prefId:pref.id };

  G.yearEvents.unshift({
    id: `disaster_${dtype.id}_${G.turn}`,
    tag: 'urgent', tagText: '天灾',
    title: `${dtype.icon} ${sevLabel}${dtype.name}`,
    scene: dtype.scene(pref.name),
    desc: `受灾地区：${pref.name}。预计损失：${Object.entries(effect).map(([k,v])=>`${getStatName(k)}${v}`).join('、')}。`,
    choices:[
      { label:`【全力赈灾】花费${reliefCost}万贯`, text:'开仓放粮，调兵救灾，全力应对', cost: reliefCost,
        effect:{ ...effect, people: Math.round((effect.people||0)*0.3), grain: Math.round((effect.grain||0)*0.4), stability:+5 },
        result:{ icon:dtype.icon, title:'赈灾得力', desc:`大王全力赈灾，损失大为减少，百姓感念王恩。`, type:'good' },
        onConfirm:()=>{ G.activeDisaster=null; G.savings=Math.max(0,G.savings-reliefCost); }
      },
      { label:`【部分赈济】花费${Math.round(reliefCost*0.5)}万贯`, text:'拨出部分钱粮，以工代赈', cost: Math.round(reliefCost*0.5),
        effect:{ ...effect, people: Math.round((effect.people||0)*0.6), grain: Math.round((effect.grain||0)*0.65) },
        result:{ icon:'📜', title:'部分赈济', desc:'赈灾力度有限，损失较大，但局势基本稳定。', type:'neutral' },
        onConfirm:()=>{ G.activeDisaster=null; G.savings=Math.max(0,G.savings-Math.round(reliefCost*0.5)); }
      },
      { label:'【坐视不理】', text:'认为地方自有应对，朝廷不予干预', cost:0,
        effect,
        result:{ icon:'💀', title:'民心尽失', desc:'朝廷袖手旁观，灾情蔓延，百姓怨声载道，民心大失。', type:'bad' },
        onConfirm:()=>{ G.activeDisaster=null; }
      },
    ]
  });
  addHistory(`⚠️ 天灾：${pref.name}发生${sevLabel}${dtype.name}！`, 'bad');
  showToast(`⚠️ 天灾！${pref.name}${dtype.name}！`, 'warn');
}

// ===================================================
//  F项：商路系统
// ===================================================
const TRADE_ROUTE_DEFS = {
  min:    { name:'闽越商路', partner:'闽国', income:18, desc:'经温州、福州，与闽国互通丝绸、茶叶', condition: n=>n.relation>=35 },
  nantang:{ name:'江南商路', partner:'南唐', income:25, desc:'经湖州、润州，与南唐互通粮食、瓷器', condition: n=>n.relation>=45 },
  zhou:   { name:'中原商路', partner:'后周', income:30, desc:'经运河北上，与中原互通货物', condition: n=>n.relation>=50 },
  sea:    { name:'海上丝路', partner:'大食/新罗', income:35, desc:'明州出海，与大食、新罗、日本通商', condition: ()=>true },
};

function _openTradeRoute(nationId, incomeMult=1.0){
  const def = TRADE_ROUTE_DEFS[nationId];
  if(!def) return;
  if((G.tradeRoutes||[]).find(r=>r.id===nationId)) return; // 已存在
  G.tradeRoutes = G.tradeRoutes || [];
  G.tradeRoutes.push({
    id: nationId,
    name: def.name,
    partner: def.partner,
    income: Math.round(def.income * incomeMult),
    turnsActive: 0,
    blocked: false,
  });
  addHistory(`🚢 开辟${def.name}，每年商路收入+${Math.round(def.income*incomeMult)}万贯。`, 'good');
}

function openTradeRouteModal(){
  const available = Object.entries(TRADE_ROUTE_DEFS).filter(([id, def])=>{
    if((G.tradeRoutes||[]).find(r=>r.id===id)) return false;
    const nation = NATIONS.find(n=>n.id===id);
    if(id==='sea') return true;
    return nation && def.condition(nation);
  });
  if(available.length===0){
    showToast('当前无可开辟的新商路', 'info'); return;
  }
  const cost = 15;
  if(G.savings < cost){ showToast(`开辟商路需要${cost}万贯存款`, 'warn'); return; }

  const opts = available.map(([id,def])=>`
    <div class="trade-route-opt" onclick="confirmOpenRoute('${id}',${cost})" style="padding:8px 10px;margin:4px 0;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:6px;cursor:pointer">
      <div style="font-weight:bold;color:#c9a84c">🚢 ${def.name}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${def.desc}</div>
      <div style="font-size:11px;color:#2ecc71;margin-top:2px">每年收入 +${def.income}万贯 · 开辟费用 ${cost}万贯</div>
    </div>`).join('');

  showModal('开辟商路', `<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">选择要开辟的商路（存款：${G.savings}万贯）：</div>${opts}`);
}

function confirmOpenRoute(id, cost){
  closeModal();
  G.savings = Math.max(0, G.savings - cost);
  _openTradeRoute(id);
  showToast(`✅ 商路已开辟！`, 'info');
  updateStats();
}

// 通用弹窗（简单实现）
function showModal(title, bodyHtml){
  let modal = document.getElementById('generic-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'generic-modal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
    modal.innerHTML=`<div style="background:#1a1a2e;border:1px solid rgba(201,168,76,0.3);border-radius:10px;padding:20px;max-width:380px;width:90%;max-height:80vh;overflow-y:auto">
      <div id="generic-modal-title" style="font-size:14px;font-weight:bold;color:#c9a84c;margin-bottom:12px"></div>
      <div id="generic-modal-body"></div>
      <button onclick="closeModal()" style="margin-top:12px;width:100%;padding:8px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);border-radius:6px;color:#c9a84c;cursor:pointer">关闭</button>
    </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('generic-modal-title').textContent = title;
  document.getElementById('generic-modal-body').innerHTML = bodyHtml;
  modal.style.display='flex';
}
function closeModal(){ const m=document.getElementById('generic-modal'); if(m) m.style.display='none'; }

// ===================================================
//  左栏面板切换（官员 / 州郡）
// ===================================================
function switchLeftPanel(panel, el){
  document.querySelectorAll('.left-main-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const officials = document.getElementById('panel-officials');
  const prefectures = document.getElementById('panel-prefectures');
  if(panel==='officials'){
    if(officials) officials.style.display='flex';
    if(prefectures) prefectures.style.display='none';
  } else {
    if(officials) officials.style.display='none';
    if(prefectures) prefectures.style.display='flex';
    renderPrefectureOverview();
  }
}

function renderPrefectureOverview(){
  const container = document.getElementById('prefecture-overview');
  if(!container) return;
  // 最大值用于归一化进度条
  const maxPop   = Math.max(...PREFECTURES.map(p=>p.population));
  const maxGrain = Math.max(...PREFECTURES.map(p=>p.grain));
  const maxTax   = Math.max(...PREFECTURES.map(p=>p.tax));
  const maxTroop = Math.max(...PREFECTURES.map(p=>p.troops));
  const maxDef   = Math.max(...PREFECTURES.map(p=>p.defense));

  container.innerHTML = PREFECTURES.map(p=>{
    const pct = (v,max)=>Math.round(v/max*100);
    const govName = p.governor ? (getOfficialById(p.governor)||{name:'空缺'}).name : '空缺';
    const threatNum = typeof p.threat === 'number' ? p.threat : (p.threat==='none'?5:p.threat==='pirates'?30:p.threat==='min'?45:p.threat==='south_tang'?55:p.threat==='zhou'?65:20);
    return `<div class="pref-item" onclick="showPrefectureDetail('${p.id}')">
      <div class="pref-item-header">
        <span class="pref-name">${p.name}</span>
        <span class="pref-governor">刺史：${govName}</span>
      </div>
      <div class="pref-bars">
        <div class="pref-bar-row">
          <span class="pref-bar-label">人口</span>
          <div class="pref-bar-track"><div class="pref-bar-fill pop" style="width:${pct(p.population,maxPop)}%"></div></div>
          <span class="pref-bar-val">${p.population}万</span>
        </div>
        <div class="pref-bar-row">
          <span class="pref-bar-label">粮储</span>
          <div class="pref-bar-track"><div class="pref-bar-fill grain" style="width:${pct(p.grain,maxGrain)}%"></div></div>
          <span class="pref-bar-val">${p.grain}万石</span>
        </div>
        <div class="pref-bar-row">
          <span class="pref-bar-label">税收</span>
          <div class="pref-bar-track"><div class="pref-bar-fill tax" style="width:${pct(p.tax,maxTax)}%"></div></div>
          <span class="pref-bar-val">${p.tax}万贯</span>
        </div>
        <div class="pref-bar-row">
          <span class="pref-bar-label">驻军</span>
          <div class="pref-bar-track"><div class="pref-bar-fill troop" style="width:${pct(p.troops,maxTroop)}%"></div></div>
          <span class="pref-bar-val">${p.troops}千</span>
        </div>
        <div class="pref-bar-row">
          <span class="pref-bar-label">城防</span>
          <div class="pref-bar-track"><div class="pref-bar-fill def" style="width:${pct(p.defense,maxDef)}%"></div></div>
          <span class="pref-bar-val">${p.defense}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function showPrefectureDetail(id){
  const p = PREFECTURES.find(x=>x.id===id);
  if(!p) return;
  G.prefectureView = id;
  const detail = document.getElementById('prefecture-detail');
  const overview = document.getElementById('prefecture-overview');
  if(!detail) return;

  const moraleColor = p.morale>=70?'#2ecc71':p.morale>=40?'#e8c97a':'#e74c3c';
  const devColor    = p.development>=70?'#3498db':p.development>=40?'#e8c97a':'#e74c3c';
  const buildings   = (p.buildings||[]).map(b=>`<span class="pref-building-tag">${b}</span>`).join('');
  const govName = p.governor ? (getOfficialById(p.governor)||{name:'空缺'}).name : '空缺';
  // threat 字段可能是字符串标识，转为数值和描述
  const THREAT_MAP = {none:{val:5,label:'无威胁'},pirates:{val:30,label:'海盗侵扰'},min:{val:45,label:'闽国威胁'},south_tang:{val:55,label:'南唐压境'},zhou:{val:65,label:'后周虎视'}};
  const threatInfo = typeof p.threat==='number' ? {val:p.threat,label:'外部威胁'} : (THREAT_MAP[p.threat]||{val:20,label:'潜在威胁'});

  detail.innerHTML = `
    <div class="pref-detail-header">
      <button class="pref-detail-back" onclick="closePrefectureDetail()">← 返回</button>
      <span class="pref-detail-title">${p.name}</span>
      <span style="font-size:10px;color:var(--text-muted);margin-left:auto">${p.title||''}</span>
    </div>
    <div class="pref-detail-body">
      <div class="pref-stat-grid">
        <div class="pref-stat-card"><div class="psc-label">👤 人口</div><div><span class="psc-val">${p.population}</span><span class="psc-unit"> 万人</span></div></div>
        <div class="pref-stat-card"><div class="psc-label">🌾 粮食储备</div><div><span class="psc-val">${p.grain}</span><span class="psc-unit"> 万石</span></div></div>
        <div class="pref-stat-card"><div class="psc-label">💰 年税收</div><div><span class="psc-val">${p.tax}</span><span class="psc-unit"> 万贯</span></div></div>
        <div class="pref-stat-card"><div class="psc-label">⚔️ 驻军</div><div><span class="psc-val">${p.troops}</span><span class="psc-unit"> 千人</span></div></div>
        <div class="pref-stat-card"><div class="psc-label">🏯 城防</div><div><span class="psc-val" style="color:${p.defense>=70?'#2ecc71':p.defense>=40?'#e8c97a':'#e74c3c'}">${p.defense}</span><span class="psc-unit">/100</span></div></div>
        <div class="pref-stat-card"><div class="psc-label">😊 民心</div><div><span class="psc-val" style="color:${moraleColor}">${p.morale}</span><span class="psc-unit">/100</span></div></div>
        <div class="pref-stat-card"><div class="psc-label">🏗️ 开发度</div><div><span class="psc-val" style="color:${devColor}">${p.development}</span><span class="psc-unit">/100</span></div></div>
        <div class="pref-stat-card"><div class="psc-label">🏛️ 刺史</div><div style="font-size:12px;color:var(--gold-light);padding-top:2px">${govName}</div></div>
      </div>
      ${p.specialty?`<div class="pref-specialty">🌟 特产：${p.specialty}</div>`:''}
      <div class="pref-section-title">建筑设施</div>
      <div class="pref-building-list">${buildings||'<span style="font-size:10px;color:var(--text-muted)">暂无建筑</span>'}</div>
      <div class="pref-section-title">外部威胁</div>
      <div class="pref-threat-bar">
        <span class="pref-threat-label" style="min-width:52px">${threatInfo.label}</span>
        <div class="pref-threat-track"><div class="pref-threat-fill" style="width:${threatInfo.val}%"></div></div>
        <span class="pref-threat-val">${threatInfo.val}</span>
      </div>
    </div>`;

  detail.style.display = 'flex';
  if(overview) overview.style.display = 'none';
}

function closePrefectureDetail(){
  const detail = document.getElementById('prefecture-detail');
  const overview = document.getElementById('prefecture-overview');
  if(detail) detail.style.display = 'none';
  if(overview) overview.style.display = 'block';
  G.prefectureView = null;
}

// ===================================================
//  ⚔️  战争系统
// ===================================================

// ── 敌国战力配置 ──────────────────────────────────
const WAR_ENEMY_CONFIG = {
  nantang: {
    name:'南唐', emoji:'🌸', color:'#e74c3c',
    troops:35, morale:80, supply:75, combat:82,
    defense:70, grain:600,
    commanders:['林仁肇','皇甫晖','边镐'],
    territory:['金陵','润州','常州'],
    warDesc:'南唐国力强盛，林仁肇等名将骁勇善战，此战凶险万分！',
    // 地理限制：只有西境/主力部队能出征南唐（湖州边境、杭州主力）
    allowedUnits: ['bianjing','zhenhai'],
    allowedDesc: '南唐在西境，只有边境守备军和镇海军可出征',
    peacePrice:{ treasury:-30, diplomacy:+15, prestige:-10 },
    victoryReward:{ prestige:+25, military:+15, treasury:+20, territory:'润州' },
    defeatPenalty:{ military:-20, people:-15, treasury:-25, prestige:-20 }
  },
  min: {
    name:'闽国残部', emoji:'🌺', color:'#e67e22',
    troops:12, morale:60, supply:55, combat:58,
    defense:50, grain:200,
    commanders:['留从效','陈洪进'],
    territory:['福州','泉州'],
    warDesc:'闽国已分裂，残余势力战力有限，是扩张的好时机。',
    // 地理限制：闽国在东南，镇东军和水师可出征
    allowedUnits: ['zhendong','shuishi'],
    allowedDesc: '闽国在东南，只有镇东军和水师可出征',
    peacePrice:{ treasury:-10, diplomacy:+10 },
    victoryReward:{ prestige:+15, military:+8, treasury:+12, territory:'温州' },
    defeatPenalty:{ military:-10, people:-8, treasury:-12, prestige:-10 }
  },
  wuyue_pirates: {
    name:'东海海寇', emoji:'🏴‍☠️', color:'#7f8c8d',
    troops:5, morale:65, supply:50, combat:55,
    defense:30, grain:80,
    commanders:['海寇首领'],
    territory:['海寇巢穴'],
    warDesc:'海寇盘踞东海，骚扰沿海，出兵剿灭可保海上贸易畅通。',
    // 地理限制：海战只有水师能出征
    allowedUnits: ['shuishi'],
    allowedDesc: '海寇在东海，只有水师可出征',
    peacePrice:{ treasury:-8 },
    victoryReward:{ prestige:+10, commerce:+12, treasury:+8, territory:null },
    defeatPenalty:{ military:-8, commerce:-10, prestige:-8 }
  }
};

// ── 战斗行动定义 ──────────────────────────────────
const WAR_ACTIONS = [
  {
    id:'frontal',
    name:'正面强攻',
    emoji:'⚔️',
    desc:'集中兵力正面突破，高风险高回报',
    myBonus:  { hit:0.35, miss:0.20 },
    enemyBonus:{ hit:0.25, miss:0.15 },
    moraleGain:8, moraleRisk:12,
    supplyUse:10,
    // 兵种加成：步兵多则正面强攻更强
    troopBonus: { infantry: 0.08 },
    flavorWin:['我军将士奋勇冲锋，敌阵被撕开一道口子！','正面突破成功，敌军阵脚大乱！'],
    flavorLoss:['正面强攻受阻，我军伤亡惨重。','敌军防线坚固，强攻未能奏效。']
  },
  {
    id:'flank',
    name:'侧翼迂回',
    emoji:'🐴',
    desc:'绕道侧翼奇袭，需要较高机动力',
    myBonus:  { hit:0.30, miss:0.15 },
    enemyBonus:{ hit:0.20, miss:0.20 },
    moraleGain:10, moraleRisk:8,
    supplyUse:12,
    // 兵种加成：骑兵多则迂回更强；水师出征时变为"水上迂回"
    troopBonus: { cavalry: 0.10, navy: 0.08 },
    flavorWin:['骑兵绕道侧翼，敌军措手不及！','迂回成功，敌军腹背受敌，阵型崩溃！'],
    flavorWinNavy:['水师绕道敌后，从水路突袭，敌军大乱！','舰队迂回包抄，敌军腹背受敌！'],
    flavorLoss:['迂回路线被敌军识破，侧翼攻势受挫。','地形不利，迂回部队陷入困境。']
  },
  {
    id:'defend',
    name:'坚守防御',
    emoji:'🛡️',
    desc:'稳固阵线，消耗敌军，等待时机',
    myBonus:  { hit:0.15, miss:0.10 },
    enemyBonus:{ hit:0.15, miss:0.30 },
    moraleGain:5, moraleRisk:3,
    supplyUse:5,
    // 兵种加成：步兵多则防守更强
    troopBonus: { infantry: 0.06 },
    flavorWin:['我军坚守阵地，敌军强攻无功而返，士气大挫！','以逸待劳，敌军消耗巨大。'],
    flavorLoss:['防线被突破，我军被迫后撤。','坚守策略未能奏效，敌军压力持续增大。']
  },
  {
    id:'ambush',
    name:'奇袭突击',
    emoji:'🌙',
    desc:'夜间奇袭敌营，成功则重创敌军',
    myBonus:  { hit:0.45, miss:0.30 },
    enemyBonus:{ hit:0.10, miss:0.10 },
    moraleGain:15, moraleRisk:18,
    supplyUse:8,
    // 兵种加成：弓弩手多则奇袭更强
    troopBonus: { archers: 0.07 },
    flavorWin:['夜袭大成功！敌营火光冲天，敌军溃不成军！','奇袭得手，敌将被斩，敌军大乱！'],
    flavorLoss:['奇袭被敌军识破，反遭伏击，损失惨重！','夜袭失败，我军在黑暗中陷入混乱。']
  },
  {
    id:'supply_cut',
    name:'截断粮道',
    emoji:'🌾',
    desc:'派轻骑截断敌军粮道，削弱其持续作战能力',
    myBonus:  { hit:0.20, miss:0.15 },
    enemyBonus:{ hit:0.10, miss:0.05 },
    moraleGain:6, moraleRisk:5,
    supplyUse:6,
    enemySupplyDmg: 20,
    // 兵种加成：骑兵截粮更有效；水师可封锁海上补给线
    troopBonus: { cavalry: 0.08, navy: 0.06 },
    flavorWin:['粮道截断成功！敌军粮草告急，士气动摇。','轻骑奔袭，敌军辎重被焚，补给中断！'],
    flavorLoss:['截粮行动被敌军骑兵击退。','敌军护粮严密，截粮未能成功。']
  }
];

// ── 备战动员 ──────────────────────────────────────
function doPreparWar(){
  const boost = { military:+8, defense:+5, treasury:-8, people:-3 };
  MILITARY_UNITS.forEach(u=>{ u.morale=Math.min(100,u.morale+10); u.supply=Math.min(100,u.supply+8); });
  applyEffects(boost);
  addHistory('备战动员：全国进入战备状态，军队士气大振。','good');
  showResult({
    icon:'🔥', title:'备战动员完成',
    desc:'大王下令全国备战！各军营士气高涨，粮草辎重加紧筹备，将士们摩拳擦掌，枕戈待旦。',
    effects: boost, type:'good'
  }, ()=>{ renderSysDetail('junshi'); });
}

// ── 宣战弹窗 ──────────────────────────────────────
// ── 宣战弹窗状态 ──
let _selectedWarTarget = null;
let _warStep = 1; // 1=选目标 2=选部队

function openDeclareWarModal(){
  const modal = document.getElementById('war-declare-modal');
  if(!modal) return;
  _selectedWarTarget = null;
  _warStep = 1;
  _renderDeclareWarStep1();
  modal.classList.add('show');
}

// 第一步：选择宣战目标
function _renderDeclareWarStep1(){
  const targets = NATIONS.filter(n=>n.id!=='wuyue_self' && n.id!=='zhou' && WAR_ENEMY_CONFIG[n.id]);
  const myTroops = MILITARY_UNITS.reduce((s,u)=>s+u.troops,0);
  const myMorale = Math.round(MILITARY_UNITS.reduce((s,u)=>s+u.morale,0)/MILITARY_UNITS.length);
  const myCombat = Math.round(MILITARY_UNITS.reduce((s,u)=>s+u.combat,0)/MILITARY_UNITS.length);

  const targetCards = targets.map(n=>{
    const cfg = WAR_ENEMY_CONFIG[n.id];
    const powerRatio = (myTroops*myCombat) / (cfg.troops*cfg.combat);
    const powerLabel = powerRatio>=1.5?'<span style="color:#2ecc71">优势</span>':powerRatio>=0.8?'<span style="color:#f39c12">均势</span>':'<span style="color:#e74c3c">劣势</span>';
    return `<div class="war-target-card" onclick="selectWarTarget('${n.id}',this)">
      <div class="war-target-header">
        <span style="font-size:20px">${n.emoji}</span>
        <div>
          <div class="war-target-name">${n.name}</div>
          <div class="war-target-ruler" style="font-size:9px;color:var(--text-muted)">${n.ruler}</div>
        </div>
        <div class="war-target-power">${powerLabel}</div>
      </div>
      <div class="war-compare-grid">
        <div class="war-compare-side">
          <div class="war-compare-label">吴越（全军）</div>
          <div class="war-compare-val" style="color:#c9a84c">${myTroops}千兵</div>
          <div class="war-compare-val">战力 ${myCombat}</div>
          <div class="war-compare-val">士气 ${myMorale}</div>
        </div>
        <div class="war-compare-vs">VS</div>
        <div class="war-compare-side">
          <div class="war-compare-label">${n.name}</div>
          <div class="war-compare-val" style="color:#e74c3c">${cfg.troops}千兵</div>
          <div class="war-compare-val">战力 ${cfg.combat}</div>
          <div class="war-compare-val">士气 ${cfg.morale}</div>
        </div>
      </div>
      <div class="war-target-desc">${cfg.warDesc}</div>
    </div>`;
  }).join('');

  document.querySelector('.war-modal-title').textContent = '⚔️ 宣战出征 · 第一步：选择目标';
  document.getElementById('war-declare-body').innerHTML = targetCards;
  const btn = document.getElementById('war-declare-confirm');
  btn.disabled = true;
  btn.textContent = '下一步：调兵遣将 →';
  btn.onclick = _goToWarStep2;
}

function selectWarTarget(nationId, el){
  _selectedWarTarget = nationId;
  document.querySelectorAll('.war-target-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('war-declare-confirm').disabled = false;
}

// 第二步：选择调动哪些部队
function _goToWarStep2(){
  if(!_selectedWarTarget) return;
  _warStep = 2;
  _renderDeclareWarStep2();
}

function _renderDeclareWarStep2(){
  const cfg = WAR_ENEMY_CONFIG[_selectedWarTarget];
  const nation = NATIONS.find(n=>n.id===_selectedWarTarget);
  const allowed = cfg.allowedUnits || MILITARY_UNITS.map(u=>u.id);

  const unitRows = MILITARY_UNITS.map(u=>{
    const commander = MILITARY_OFFICIALS.find(o=>o.id===u.commander);
    const cmdName = commander ? commander.name : '—';
    const isTraining = !!(G.trainingOrders||[]).find(o=>o.unitId===u.id);
    const isAllowed = allowed.includes(u.id) && !isTraining;
    const disabledAttr = isAllowed ? '' : 'data-disabled="true"';
    const disabledStyle = isAllowed ? '' : 'opacity:0.45;cursor:not-allowed;';
    const disabledTag = isTraining
      ? `<span style="font-size:9px;color:#3498db;margin-left:6px">🏋️ 训练中，不可出征</span>`
      : (!isAllowed ? `<span style="font-size:9px;color:#e74c3c;margin-left:6px">⛔ 地理不符</span>` : '');
    const clickHandler = isAllowed ? `onclick="toggleWarUnit('${u.id}',this)"` : '';
    return `<div class="war-unit-row" id="war-unit-row-${u.id}" ${clickHandler} ${disabledAttr} style="${disabledStyle}">
      <div class="war-unit-check" id="war-unit-check-${u.id}">${isAllowed ? '☐' : '✕'}</div>
      <div class="war-unit-info">
        <div class="war-unit-name">${u.emoji} ${u.name}${disabledTag}
          <span style="font-size:9px;color:var(--text-muted);margin-left:4px">驻${u.location} · ${u.type}</span>
        </div>
        <div class="war-unit-stats">
          <span class="war-unit-stat-item" style="color:#c9a84c">⚔ ${u.troops}千兵</span>
          <span class="war-unit-stat-item">🔥 士气${u.morale}</span>
          <span class="war-unit-stat-item">💪 战力${u.combat}</span>
          <span class="war-unit-stat-item">📦 物资${u.supply}</span>
          <span class="war-unit-stat-item" style="color:#aaa">主将：${cmdName}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  document.querySelector('.war-modal-title').textContent = `⚔️ 出征${cfg.name} · 第二步：调兵遣将`;
  document.getElementById('war-declare-body').innerHTML = `
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;padding:0 2px">
      选择调动哪些部队出征（至少选一支）。未选中的部队留守本地。
    </div>
    <div style="font-size:10px;color:#f39c12;margin-bottom:8px;padding:4px 8px;background:rgba(243,156,18,0.08);border-radius:5px">
      📍 ${cfg.allowedDesc || '所有部队均可出征'}
    </div>
    <div id="war-unit-list">${unitRows}</div>
    <div id="war-force-summary" style="margin-top:10px;padding:8px 10px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);border-radius:6px;font-size:11px">
      <span style="color:var(--text-muted)">请选择部队</span>
    </div>
    <div style="margin-top:8px;padding:6px 10px;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.2);border-radius:6px;font-size:11px;color:var(--text-muted)">
      敌方：${nation.emoji} ${cfg.name} — ${cfg.troops}千兵 · 战力${cfg.combat} · 士气${cfg.morale}
    </div>`;

  const btn = document.getElementById('war-declare-confirm');
  btn.disabled = true;
  btn.textContent = '⚔️ 确认宣战出征';
  btn.onclick = confirmDeclareWar;
}

// 勾选/取消部队
function toggleWarUnit(unitId, el){
  el.classList.toggle('selected');
  const check = document.getElementById('war-unit-check-'+unitId);
  check.textContent = el.classList.contains('selected') ? '☑' : '☐';
  _updateWarForceSummary();
}

function _updateWarForceSummary(){
  const selected = MILITARY_UNITS.filter(u=>
    document.getElementById('war-unit-row-'+u.id)?.classList.contains('selected')
  );
  const btn = document.getElementById('war-declare-confirm');
  const summary = document.getElementById('war-force-summary');
  if(!summary) return;

  if(selected.length===0){
    summary.innerHTML = '<span style="color:var(--text-muted)">请选择部队</span>';
    btn.disabled = true;
    return;
  }

  const totalTroops = selected.reduce((s,u)=>s+u.troops, 0);
  const avgMorale   = Math.round(selected.reduce((s,u)=>s+u.morale*u.troops, 0) / totalTroops);
  const avgCombat   = Math.round(selected.reduce((s,u)=>s+u.combat*u.troops, 0) / totalTroops);
  const avgSupply   = Math.round(selected.reduce((s,u)=>s+u.supply*u.troops, 0) / totalTroops);
  const names = selected.map(u=>u.name).join('、');

  // 找能力最高的指挥官（从选中部队的主将里选）
  const commanders = selected.map(u=>MILITARY_OFFICIALS.find(o=>o.id===u.commander)).filter(Boolean);
  const bestCmd = commanders.sort((a,b)=>b.ability-a.ability)[0];

  const cfg = WAR_ENEMY_CONFIG[_selectedWarTarget];
  const powerRatio = (totalTroops*avgCombat)/(cfg.troops*cfg.combat);
  const powerColor = powerRatio>=1.5?'#2ecc71':powerRatio>=0.8?'#f39c12':'#e74c3c';
  const powerText  = powerRatio>=1.5?'优势':powerRatio>=0.8?'均势':'劣势';

  summary.innerHTML = `
    <div style="color:#c9a84c;font-weight:bold;margin-bottom:4px">出征兵力汇总</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <span>📋 ${names}</span>
    </div>
    <div style="display:flex;gap:12px;margin-top:4px;flex-wrap:wrap">
      <span style="color:#c9a84c">⚔ 总兵力 <b>${totalTroops}千</b></span>
      <span>🔥 士气 <b>${avgMorale}</b></span>
      <span>💪 战力 <b>${avgCombat}</b></span>
      <span>📦 物资 <b>${avgSupply}</b></span>
    </div>
    <div style="margin-top:4px">
      主将：<b>${bestCmd ? bestCmd.name : '—'}</b>
      &nbsp;|&nbsp; 胜算：<span style="color:${powerColor};font-weight:bold">${powerText}</span>
    </div>`;
  btn.disabled = false;
}

function closeDeclareWarModal(){
  document.getElementById('war-declare-modal').classList.remove('show');
  _selectedWarTarget = null;
  _warStep = 1;
}

function confirmDeclareWar(){
  if(!_selectedWarTarget) return;
  // 收集选中的部队 id
  const selectedUnitIds = MILITARY_UNITS
    .filter(u=>document.getElementById('war-unit-row-'+u.id)?.classList.contains('selected'))
    .map(u=>u.id);
  if(selectedUnitIds.length===0){ showToast('请至少选择一支部队出征！','warn'); return; }
  closeDeclareWarModal();
  startWar(_selectedWarTarget, selectedUnitIds);
}

// ── 开战初始化 ──────────────────────────────────────
function startWar(targetId, selectedUnitIds){
  const cfg = WAR_ENEMY_CONFIG[targetId];
  const nation = NATIONS.find(n=>n.id===targetId);
  if(!cfg||!nation) return;

  // 确定出征部队（传入 selectedUnitIds 则用选中的，否则取全部）
  const unitIds = (selectedUnitIds && selectedUnitIds.length > 0)
    ? selectedUnitIds
    : MILITARY_UNITS.map(u=>u.id);
  const selectedUnits = MILITARY_UNITS.filter(u=>unitIds.includes(u.id));

  // 合计兵力
  const totalTroops = selectedUnits.reduce((s,u)=>s+u.troops, 0);
  // 加权平均（按兵力加权）
  const avgMorale  = Math.round(selectedUnits.reduce((s,u)=>s+u.morale*u.troops, 0) / totalTroops);
  const avgCombat  = Math.round(selectedUnits.reduce((s,u)=>s+u.combat*u.troops, 0) / totalTroops);
  const avgSupply  = Math.round(selectedUnits.reduce((s,u)=>s+u.supply*u.troops, 0) / totalTroops);

  // 选能力最高的主将（从出征部队的主将里选）
  const commanders = selectedUnits.map(u=>MILITARY_OFFICIALS.find(o=>o.id===u.commander)).filter(Boolean);
  const commander  = commanders.sort((a,b)=>b.ability-a.ability)[0]
    || [...MILITARY_OFFICIALS].sort((a,b)=>b.ability-a.ability)[0];

  // ── A项：出征抽兵 —— 从各部队扣减兵力 ──
  selectedUnits.forEach(u=>{ u._troopsBeforeWar = u.troops; u._moraleBeforeWar = u.morale; u.troops = 0; });

  // 统计出征部队兵种构成（用于B项兵种加成）
  // 按各部队的兵种比例字段（infantry/cavalry/navy/archers/engineers）加权统计实际兵力
  const troopTypeMap = { infantry:0, cavalry:0, navy:0, archers:0, engineers:0 };
  selectedUnits.forEach(u=>{
    const t = u._troopsBeforeWar || u.troops || 0;
    troopTypeMap.infantry  += t * ((u.infantry  || 0) / 100);
    troopTypeMap.cavalry   += t * ((u.cavalry   || 0) / 100);
    troopTypeMap.navy      += t * ((u.navy      || 0) / 100);
    troopTypeMap.archers   += t * ((u.archers   || 0) / 100);
    troopTypeMap.engineers += t * ((u.engineers || 0) / 100);
  });

  G.war = {
    targetId,
    targetName: cfg.name,
    targetEmoji: nation.emoji,
    round: 1,
    maxRounds: 10,
    phase: 'battle',   // battle | peace_offer | ended
    deployedUnitIds: unitIds,   // A项：记录出征部队ID，战后归还
    troopTypeMap,               // B项：兵种构成
    myForce: {
      name: '吴越军',
      troops: totalTroops,
      morale: avgMorale,
      supply: avgSupply,
      combat: avgCombat,
      commanderId: commander.id,
      commanderName: commander.name,
      commanderAbility: commander.ability
    },
    enemyForce: {
      name: cfg.name,
      troops: cfg.troops,
      morale: cfg.morale,
      supply: cfg.supply,
      combat: cfg.combat,
      commanderName: cfg.commanders[0]
    },
    battleLog: [],
    warScore: 0,       // >0 我方优势，<0 敌方优势
    cfg: cfg,
    territory: [...(cfg.territory||[])],
    startTurn: G.turn
  };

  // 外交影响
  nation.relation = Math.max(0, nation.relation - 30);
  nation.status = 'hostile';
  G.stats.diplomacy = Math.max(0, G.stats.diplomacy - 10);
  G.stats.prestige = Math.min(100, G.stats.prestige + 5);

  addHistory(`向${cfg.name}宣战！战争爆发！`, 'bad');
  showToast(`⚔️ 战争爆发！吴越向${cfg.name}宣战！`, 'warn');

  // 打开战役界面
  setTimeout(()=>openBattleModal(), 300);
}

// ── 战役主界面 ──────────────────────────────────────
function openBattleModal(){
  const modal = document.getElementById('war-battle-modal');
  if(!modal||!G.war) return;
  renderBattleModal();
  modal.classList.add('show');
}

function renderBattleModal(){
  if(!G.war) return;
  const w = G.war;
  const my = w.myForce;
  const en = w.enemyForce;

  // 战场态势
  const scoreBar = Math.round(50 + w.warScore * 2);
  const scoreBarClamped = Math.max(5, Math.min(95, scoreBar));
  const scoreLabel = w.warScore>15?'大优':w.warScore>5?'优势':w.warScore>-5?'均势':w.warScore>-15?'劣势':'大劣';

  // 兵力条
  const maxTroops = Math.max(my.troops, en.troops, 1);
  const myTroopPct = Math.round(my.troops/maxTroops*100);
  const enTroopPct = Math.round(en.troops/maxTroops*100);

  // 战斗行动按钮
  const actionBtns = WAR_ACTIONS.map(a=>`
    <button class="war-action-btn" onclick="executeBattleAction('${a.id}')" title="${a.desc}">
      <span class="war-action-emoji">${a.emoji}</span>
      <span class="war-action-name">${a.name}</span>
      <span class="war-action-desc">${a.desc}</span>
    </button>`).join('');

  // 战斗日志（最近5条）
  const logHtml = w.battleLog.slice(-6).reverse().map(l=>
    `<div class="war-log-item war-log-${l.type}">${l.text}</div>`
  ).join('') || '<div class="war-log-item war-log-neutral">战役开始，等待你的指令...</div>';

  document.getElementById('war-battle-body').innerHTML = `
    <div class="war-battle-header">
      <div class="war-battle-title">⚔️ ${w.targetName}之战 · 第${w.round}/${w.maxRounds}回合</div>
      <div class="war-score-bar-wrap">
        <span style="font-size:9px;color:#c9a84c">吴越</span>
        <div class="war-score-track">
          <div class="war-score-fill" style="width:${scoreBarClamped}%"></div>
          <div class="war-score-center"></div>
        </div>
        <span style="font-size:9px;color:#e74c3c">${w.targetName}</span>
      </div>
      <div class="war-score-label" style="color:${w.warScore>=0?'#2ecc71':'#e74c3c'}">${scoreLabel}</div>
    </div>

    <div class="war-forces-row">
      <div class="war-force-card war-force-my">
        <div class="war-force-name">🏳️ 吴越军</div>
        <div class="war-force-commander">主将：${my.commanderName}</div>
        <div class="war-force-stat">
          <span>兵力</span>
          <div class="war-force-bar-wrap"><div class="war-force-bar" style="width:${myTroopPct}%;background:#c9a84c"></div></div>
          <span class="war-force-val">${my.troops}千</span>
        </div>
        <div class="war-force-stat">
          <span>士气</span>
          <div class="war-force-bar-wrap"><div class="war-force-bar" style="width:${my.morale}%;background:${my.morale>=60?'#2ecc71':'#e74c3c'}"></div></div>
          <span class="war-force-val">${my.morale}</span>
        </div>
        <div class="war-force-stat">
          <span>物资</span>
          <div class="war-force-bar-wrap"><div class="war-force-bar" style="width:${my.supply}%;background:${my.supply>=40?'#f39c12':'#e74c3c'}"></div></div>
          <span class="war-force-val">${my.supply}</span>
        </div>
        <div class="war-force-stat">
          <span>战力</span>
          <div class="war-force-bar-wrap"><div class="war-force-bar" style="width:${my.combat}%;background:#3498db"></div></div>
          <span class="war-force-val">${my.combat}</span>
        </div>
      </div>

      <div class="war-vs-divider">⚔️</div>

      <div class="war-force-card war-force-enemy">
        <div class="war-force-name" style="color:#e74c3c">${w.targetEmoji} ${en.name}</div>
        <div class="war-force-commander">主将：${en.commanderName}</div>
        <div class="war-force-stat">
          <span>兵力</span>
          <div class="war-force-bar-wrap"><div class="war-force-bar" style="width:${enTroopPct}%;background:#e74c3c"></div></div>
          <span class="war-force-val">${en.troops}千</span>
        </div>
        <div class="war-force-stat">
          <span>士气</span>
          <div class="war-force-bar-wrap"><div class="war-force-bar" style="width:${en.morale}%;background:${en.morale>=60?'#e67e22':'#c0392b'}"></div></div>
          <span class="war-force-val">${en.morale}</span>
        </div>
        <div class="war-force-stat">
          <span>物资</span>
          <div class="war-force-bar-wrap"><div class="war-force-bar" style="width:${en.supply}%;background:#e67e22"></div></div>
          <span class="war-force-val">${en.supply}</span>
        </div>
        <div class="war-force-stat">
          <span>战力</span>
          <div class="war-force-bar-wrap"><div class="war-force-bar" style="width:${en.combat}%;background:#9b59b6"></div></div>
          <span class="war-force-val">${en.combat}</span>
        </div>
      </div>
    </div>

    ${(()=>{
      const grainPerRound = Math.max(1, Math.round(w.myForce.troops * 0.5));
      const roundsLeft = grainPerRound > 0 ? Math.floor(G.stats.grain / grainPerRound) : 99;
      const grainPct = Math.min(100, G.stats.grain);
      const grainColor = G.stats.grain > 50 ? '#f39c12' : G.stats.grain > 20 ? '#e67e22' : '#e74c3c';
      const urgency = roundsLeft <= 0 ? '⚠️ 粮草耗尽！' : roundsLeft <= 2 ? `⚠️ 仅剩${roundsLeft}回合！` : `约${roundsLeft}回合`;
      const urgencyColor = roundsLeft <= 2 ? '#e74c3c' : 'var(--text-muted)';
      const bgColor = roundsLeft <= 2 ? 'rgba(231,76,60,0.12)' : 'rgba(243,156,18,0.08)';
      const borderColor = roundsLeft <= 2 ? 'rgba(231,76,60,0.4)' : 'rgba(243,156,18,0.25)';
      return `<div style="margin:6px 0;padding:5px 10px;background:${bgColor};border:1px solid ${borderColor};border-radius:6px;font-size:11px;display:flex;align-items:center;gap:8px">
        <span>🌾 粮草：</span>
        <div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${grainPct}%;background:${grainColor};border-radius:3px;transition:width 0.3s"></div>
        </div>
        <span style="color:${grainColor};font-weight:bold">${G.stats.grain}万石</span>
        <span style="color:var(--text-muted)">-${grainPerRound}/回合</span>
        <span style="color:${urgencyColor};font-weight:${roundsLeft<=2?'bold':'normal'}">${urgency}</span>
      </div>`;
    })()}

    <div class="war-actions-title">选择本回合战术：</div>
    <div class="war-actions-grid">${actionBtns}</div>

    <div class="war-log-title">战场动态</div>
    <div class="war-log-list">${logHtml}</div>

    <div class="war-bottom-btns">
      <button class="war-btn-peace" onclick="openSuePeaceModal()">🕊️ 求和停战</button>
      <button class="war-btn-close" onclick="closeBattleModal()">暂时关闭</button>
    </div>`;
}

function closeBattleModal(){
  document.getElementById('war-battle-modal').classList.remove('show');
}

// ── 执行战斗行动 ──────────────────────────────────
function executeBattleAction(actionId){
  if(!G.war || G.war.phase!=='battle') return;
  const w = G.war;
  const act = WAR_ACTIONS.find(a=>a.id===actionId);
  if(!act) return;

  const my = w.myForce;
  const en = w.enemyForce;

  // ── 指挥官加成 ──
  const cmdBonus = (my.commanderAbility - 60) / 200; // -0.15 ~ +0.2

  // ── B项：兵种加成 ──
  // troopBonus 格式：{ 步兵: 0.1, 水军: 0.15 } 表示该行动对对应兵种有命中加成
  let troopBonus = 0;
  if(act.troopBonus && w.troopTypeMap){
    const totalTroops = Object.values(w.troopTypeMap).reduce((s,v)=>s+v,0)||1;
    Object.entries(act.troopBonus).forEach(([type, bonus])=>{
      const ratio = (w.troopTypeMap[type]||0) / totalTroops;
      troopBonus += bonus * ratio;
    });
  }

  // ── 我方攻击 ──
  const myAttackRoll = Math.random();
  const myHitChance = act.myBonus.hit + cmdBonus + troopBonus + (my.combat/200) + (my.morale/300) - (en.defense||0)/400;
  const myHit = myAttackRoll < myHitChance;

  // ── 敌方反击 ──
  const enAttackRoll = Math.random();
  const enHitChance = act.enemyBonus.hit + (en.combat/200) + (en.morale/300) - (my.defense||0)/400;
  const enHit = enAttackRoll < enHitChance;

  // ── 伤亡计算 ──
  let myLoss = 0, enLoss = 0;
  let myMoraleDelta = 0, enMoraleDelta = 0;
  let logText = '';
  let logType = 'neutral';

  if(myHit){
    enLoss = Math.max(1, Math.round((my.combat * 0.08 + Math.random()*3) * (my.supply/100)));
    enMoraleDelta = -(act.moraleGain + Math.floor(Math.random()*5));
    w.warScore += 3 + Math.floor(Math.random()*4);
    logText = rand(act.flavorWin) + ` 敌军损失${enLoss}千人，士气-${Math.abs(enMoraleDelta)}。`;
    logType = 'win';
  } else {
    enMoraleDelta = -(Math.floor(Math.random()*3));
    w.warScore += 1;
    logText = rand(act.flavorLoss);
    logType = 'neutral';
  }

  if(enHit){
    myLoss = Math.max(1, Math.round((en.combat * 0.07 + Math.random()*2) * (en.supply/100)));
    myMoraleDelta = -(act.moraleRisk + Math.floor(Math.random()*5));
    w.warScore -= 2 + Math.floor(Math.random()*3);
    logText += ` 我军损失${myLoss}千人，士气-${Math.abs(myMoraleDelta)}。`;
    logType = myHit ? 'neutral' : 'loss';
  } else {
    myMoraleDelta += Math.floor(Math.random()*3);
  }

  // 截粮特殊效果
  if(actionId==='supply_cut' && myHit){
    en.supply = Math.max(0, en.supply - (act.enemySupplyDmg||15));
    logText += ` 敌军粮草受损，物资-${act.enemySupplyDmg||15}！`;
  }

  // 物资消耗
  my.supply = Math.max(0, my.supply - act.supplyUse);
  en.supply = Math.max(0, en.supply - Math.floor(Math.random()*6+3));

  // ── D项：每回合消耗全国粮草 ──
  const grainCost = Math.max(1, Math.round(my.troops * 0.5)); // 每千兵每回合耗0.5万石
  G.stats.grain = Math.max(0, G.stats.grain - grainCost);
  if(G.stats.grain <= 0){
    logText += ` ⚠️ 粮草耗尽！军心大乱！`;
    my.morale = Math.max(5, my.morale - 20);
    my.supply = 0;
  }

  // 应用变化
  my.troops = Math.max(0, my.troops - myLoss);
  en.troops = Math.max(0, en.troops - enLoss);
  my.morale = Math.max(5, Math.min(100, my.morale + myMoraleDelta));
  en.morale = Math.max(5, Math.min(100, en.morale + enMoraleDelta));

  // 物资影响战力
  if(my.supply < 30) my.combat = Math.max(20, my.combat - 3);
  if(en.supply < 30) en.combat = Math.max(20, en.combat - 3);

  // 记录日志
  w.battleLog.push({ round: w.round, text: `【第${w.round}回合·${act.name}】${logText}`, type: logType });

  w.round++;

  // ── 检查战争结束条件 ──
  const warEnded = checkWarEnd();
  if(!warEnded){
    // 敌方AI反击（随机选择行动）
    const aiAction = rand(WAR_ACTIONS);
    const aiHit = Math.random() < (aiAction.myBonus.hit + en.combat/250 + en.morale/350);
    if(aiHit){
      const aiLoss = Math.max(0, Math.round(en.combat*0.04 + Math.random()*2));
      my.troops = Math.max(0, my.troops - aiLoss);
      my.morale = Math.max(5, my.morale - Math.floor(Math.random()*6+2));
      w.warScore -= 1;
      w.battleLog.push({ round: w.round, text: `【敌方·${aiAction.name}】${en.commanderName}发动${aiAction.name}，我军损失${aiLoss}千人。`, type:'loss' });
    } else {
      w.battleLog.push({ round: w.round, text: `【敌方·${aiAction.name}】${en.commanderName}发动${aiAction.name}，被我军化解。`, type:'neutral' });
    }
    checkWarEnd();
  }

  // ── 随机战场事件（约每3回合触发一次）──
  if(!G.war && w.round > 1) { renderBattleModal(); return; } // 战争已结束
  if(Math.random() < 0.30 && w.round > 1){
    triggerWarRandomEvent(w);
  }

  renderBattleModal();
}

// ── 战场随机事件 ──────────────────────────────────
const WAR_RANDOM_EVENTS = [
  {
    id:'rain', weight:15,
    title:'大雨连绵',
    icon:'🌧️',
    apply(w){
      const my = w.myForce, en = w.enemyForce;
      my.combat = Math.max(20, my.combat - 5);
      en.combat = Math.max(20, en.combat - 5);
      // 骑兵多则我方受影响更大
      const cavRatio = (w.troopTypeMap?.cavalry||0) / (Object.values(w.troopTypeMap||{}).reduce((s,v)=>s+v,1));
      if(cavRatio > 0.2){ my.combat = Math.max(20, my.combat - 3); }
      return `大雨连绵，道路泥泞，双方战力均下降。${cavRatio>0.2?'骑兵行动受阻，我军额外受损。':''}`;
    }, type:'neutral'
  },
  {
    id:'plague', weight:8,
    title:'军中疫病',
    icon:'🤒',
    apply(w){
      const my = w.myForce;
      const loss = Math.max(1, Math.round(my.troops * 0.08));
      my.troops = Math.max(1, my.troops - loss);
      my.morale = Math.max(5, my.morale - 10);
      my.supply = Math.max(0, my.supply - 10);
      return `军中爆发疫病，损失${loss}千人，士气-10，物资-10。`;
    }, type:'loss'
  },
  {
    id:'desertion', weight:10,
    title:'士卒逃亡',
    icon:'🏃',
    apply(w){
      const my = w.myForce;
      // 士气越低越容易逃亡
      if(my.morale < 50){
        const loss = Math.max(1, Math.round(my.troops * 0.06));
        my.troops = Math.max(1, my.troops - loss);
        my.morale = Math.max(5, my.morale - 8);
        return `士气低落，${loss}千士卒趁夜逃亡，军心动摇。`;
      }
      return null; // 士气高时不触发
    }, type:'loss'
  },
  {
    id:'reinforcement', weight:12,
    title:'援军抵达',
    icon:'🚩',
    apply(w){
      const my = w.myForce;
      const gain = Math.max(1, Math.round(2 + Math.random()*3));
      my.troops += gain;
      my.morale = Math.min(100, my.morale + 8);
      w.warScore += 2;
      return `后方援军${gain}千人抵达战场，士气大振！`;
    }, type:'win'
  },
  {
    id:'spy_intel', weight:12,
    title:'细作传报',
    icon:'🕵️',
    apply(w){
      const en = w.enemyForce;
      en.supply = Math.max(0, en.supply - 12);
      w.warScore += 2;
      return `细作传来敌军粮道情报，我军截断敌军补给，敌方物资-12。`;
    }, type:'win'
  },
  {
    id:'enemy_reinforcement', weight:10,
    title:'敌军援兵',
    icon:'⚠️',
    apply(w){
      const en = w.enemyForce;
      const gain = Math.max(1, Math.round(2 + Math.random()*4));
      en.troops += gain;
      en.morale = Math.min(100, en.morale + 10);
      w.warScore -= 3;
      return `敌方援军${gain}千人赶到，敌军士气大振，形势趋于不利！`;
    }, type:'loss'
  },
  {
    id:'supply_convoy', weight:10,
    title:'粮草车队抵达',
    icon:'🐂',
    apply(w){
      const my = w.myForce;
      const grainGain = Math.max(5, Math.round(10 + Math.random()*10));
      G.stats.grain = Math.min(999, G.stats.grain + grainGain);
      my.supply = Math.min(100, my.supply + 15);
      return `后方粮草车队抵达，补充粮草${grainGain}万石，物资+15。`;
    }, type:'win'
  },
  {
    id:'night_raid_enemy', weight:8,
    title:'敌军夜袭',
    icon:'🌙',
    apply(w){
      const my = w.myForce;
      const loss = Math.max(1, Math.round(my.troops * 0.05));
      my.troops = Math.max(1, my.troops - loss);
      my.morale = Math.max(5, my.morale - 12);
      w.warScore -= 2;
      return `敌军趁夜偷袭我营，我军损失${loss}千人，士气-12，措手不及！`;
    }, type:'loss'
  },
  {
    id:'high_morale', weight:8,
    title:'将士用命',
    icon:'🔥',
    apply(w){
      const my = w.myForce;
      my.morale = Math.min(100, my.morale + 15);
      my.combat = Math.min(100, my.combat + 5);
      w.warScore += 2;
      return `${w.myForce.commanderName}亲临阵前鼓舞士气，将士用命，士气+15，战力+5！`;
    }, type:'win'
  }
];

function triggerWarRandomEvent(w){
  // 加权随机选取事件
  const pool = WAR_RANDOM_EVENTS;
  const totalWeight = pool.reduce((s,e)=>s+e.weight, 0);
  let r = Math.random() * totalWeight;
  let event = pool[pool.length-1];
  for(const e of pool){ r -= e.weight; if(r <= 0){ event = e; break; } }

  const result = event.apply(w);
  if(result === null) return; // 条件不满足，不触发

  w.battleLog.push({
    round: w.round,
    text: `【${event.icon} ${event.title}】${result}`,
    type: event.type
  });
  checkWarEnd();
}

// ── 战争结束判定 ──────────────────────────────────
function checkWarEnd(){
  if(!G.war) return false;
  const w = G.war;
  const my = w.myForce;
  const en = w.enemyForce;

  // 敌军覆灭
  if(en.troops<=0 || en.morale<=10){
    endWar('victory_total');
    return true;
  }
  // 我军覆灭
  if(my.troops<=0 || my.morale<=10){
    endWar('defeat_total');
    return true;
  }
  // 达到最大回合数
  if(w.round > w.maxRounds){
    if(w.warScore > 10) endWar('victory_points');
    else if(w.warScore < -10) endWar('defeat_points');
    else endWar('stalemate');
    return true;
  }
  // 敌军粮草耗尽
  if(en.supply<=0 && en.morale<40){
    endWar('victory_supply');
    return true;
  }
  // D项：我方粮草耗尽，士气崩溃
  if(G.stats.grain<=0 && my.morale<=15){
    endWar('defeat_supply');
    return true;
  }
  return false;
}

// ── 战争结束处理 ──────────────────────────────────
function endWar(result){
  if(!G.war) return;
  const w = G.war;
  const cfg = w.cfg;
  closeBattleModal();

  let icon, title, desc, effects, type;

  // ── A项：战后归还兵力 ──
  const deployedIds = w.deployedUnitIds || [];
  const isVictory = result==='victory_total'||result==='victory_points'||result==='victory_supply';
  const isDefeat  = result==='defeat_total'||result==='defeat_points'||result==='defeat_supply';
  deployedIds.forEach(uid=>{
    const unit = MILITARY_UNITS.find(u=>u.id===uid);
    if(!unit) return;
    const origTroops = unit._troopsBeforeWar || 0;
    if(isVictory){
      // 胜利：按战场剩余比例归还，最少保留原兵力20%
      const ratio = Math.max(0.2, w.myForce.troops / Math.max(1, deployedIds.reduce((s,id)=>{
        const u2=MILITARY_UNITS.find(x=>x.id===id); return s+(u2?u2._troopsBeforeWar||0:0);
      },0)));
      unit.troops = Math.max(1, Math.round(origTroops * ratio));
      unit.morale = Math.min(100, (unit._moraleBeforeWar||unit.morale) + 10);
    } else if(isDefeat){
      // 败退：损失惨重，归还原兵力30%~60%
      const lossRatio = result==='defeat_supply' ? 0.5 : 0.35;
      unit.troops = Math.max(1, Math.round(origTroops * lossRatio));
      unit.morale = Math.max(15, (unit._moraleBeforeWar||unit.morale) - 20);
    } else {
      // 平局：归还原兵力70%
      unit.troops = Math.max(1, Math.round(origTroops * 0.7));
      unit.morale = Math.max(20, (unit._moraleBeforeWar||unit.morale) - 5);
    }
    delete unit._troopsBeforeWar;
    delete unit._moraleBeforeWar;
  });

  if(isVictory){
    icon = result==='victory_total'?'🏆':'⚔️';
    title = result==='victory_total'?'大获全胜！':result==='victory_supply'?'断粮制胜！':'积分胜利';
    const reward = cfg.victoryReward;
    effects = { ...reward };
    delete effects.territory;
    desc = `吴越军队取得胜利！${w.myForce.commanderName}率军凯旋，${cfg.name}被迫求和。`;
    if(reward.territory){
      desc += `\n\n战后割让：${reward.territory}并入吴越版图！`;
      const pref = PREFECTURES.find(p=>p.name===reward.territory);
      if(pref){ pref.threat='none'; }
    }
    type = 'good';
    const nation = NATIONS.find(n=>n.id===w.targetId);
    if(nation){ nation.relation = Math.max(0, nation.relation-20); nation.threat='low'; }

  } else if(isDefeat){
    icon = result==='defeat_supply'?'🌾':'💀';
    title = result==='defeat_supply'?'粮草耗尽，败退而归':result==='defeat_total'?'惨败而归':'战败求和';
    const penalty = cfg.defeatPenalty;
    effects = { ...penalty };
    desc = result==='defeat_supply'
      ? `粮草耗尽，军心崩溃！${w.myForce.commanderName}率残部仓皇撤退，${cfg.name}乘胜追击。`
      : `吴越军队战败！${w.myForce.commanderName}率残部撤退，${cfg.name}乘胜追击，吴越被迫割地赔款。`;
    type = 'bad';
    const nation = NATIONS.find(n=>n.id===w.targetId);
    if(nation){ nation.relation=Math.min(100,nation.relation+10); nation.threat='high'; }

  } else { // stalemate
    icon = '🤝';
    title = '两军对峙，议和收兵';
    effects = { military:-5, treasury:-10, prestige:-3 };
    desc = `双方激战多回合，未分胜负。${cfg.name}提出议和，吴越接受停战，各自退兵。`;
    type = 'neutral';
  }

  applyEffects(effects);
  addHistory(`${w.targetName}之战结束：${title}`, type);

  // 记录战争历史
  G.warHistory.push({
    turn: G.turn,
    target: w.targetName,
    result,
    rounds: w.round-1,
    warScore: w.warScore
  });

  G.war = null;
  renderSysDetail('junshi');

  showResult({ icon, title, desc, effects, type }, ()=>{
    showIdleState();
  });
}

// ── 求和弹窗 ──────────────────────────────────────
function openSuePeaceModal(){
  if(!G.war){ showToast('当前并无战事','info'); return; }
  const modal = document.getElementById('war-peace-modal');
  if(!modal) return;
  const w = G.war;
  const cfg = w.cfg;
  const price = cfg.peacePrice;
  const priceText = Object.entries(price).map(([k,v])=>`${getStatName(k)} ${v>0?'+':''}${v}`).join('、');
  const statusText = w.warScore>5?'我方占优，求和代价较小':w.warScore<-5?'我方劣势，求和代价较大':'双方均势，求和代价适中';

  document.getElementById('war-peace-body').innerHTML = `
    <div class="war-peace-status">当前战况：<span style="color:${w.warScore>=0?'#2ecc71':'#e74c3c'}">${statusText}</span></div>
    <div class="war-peace-desc">向${w.targetName}遣使求和，对方要求：</div>
    <div class="war-peace-price">${priceText}</div>
    <div class="war-peace-note">求和后战争立即结束，双方停止交战。</div>`;

  modal.classList.add('show');
}

function closePeaceModal(){
  document.getElementById('war-peace-modal').classList.remove('show');
}

function confirmSuePeace(){
  closePeaceModal();
  closeBattleModal();
  if(!G.war) return;
  const cfg = G.war.cfg;
  applyEffects(cfg.peacePrice);
  addHistory(`向${G.war.targetName}求和，战争结束。`, 'neutral');
  G.warHistory.push({ turn:G.turn, target:G.war.targetName, result:'peace', rounds:G.war.round-1, warScore:G.war.warScore });
  G.war = null;
  renderSysDetail('junshi');
  showResult({
    icon:'🕊️', title:'议和成功',
    desc:`吴越遣使求和，${cfg.name}接受停战。战争结束，双方各自退兵。`,
    effects: cfg.peacePrice, type:'neutral'
  }, ()=>showIdleState());
}

// ── 战争状态下的年度结算补丁 ──────────────────────
function warYearEndCheck(){
  if(!G.war) return;
  const w = G.war;
  // 战争持续消耗
  const warDrain = { treasury:-8, people:-5, military:-3 };
  applyEffects(warDrain);
  w.myForce.supply = Math.max(0, w.myForce.supply - 15);
  w.enemyForce.supply = Math.max(0, w.enemyForce.supply - 10);
  addHistory(`战争持续，国力消耗：国库-8，民心-5。`, 'bad');
  showToast('⚔️ 战争仍在持续，国力持续消耗！', 'warn');
}

// ===================================================
//  存档系统（localStorage，3个槽位 + 自动存档）
// ===================================================

const SAVE_PREFIX = 'wuyue_save_';
const AUTO_SLOT   = 'auto';
const SAVE_SLOTS  = [1, 2, 3];

// ── 序列化：把当前游戏状态打包成可存储的对象 ──
function serializeGame(){
  return {
    version: 2,
    savedAt: Date.now(),
    turn: G.turn,
    budget: G.budget,
    budgetUsed: G.budgetUsed,
    corruption: G.corruption,
    taxIncome: G.taxIncome,
    savings: G.savings,
    energy: G.energy,
    yearUsedActions: [...G.yearUsedActions],
    stats: { ...G.stats },
    yearEvents: G.yearEvents,
    usedEventIds: [...G.usedEventIds],
    history: G.history.slice(-60),   // 只保留最近60条
    intel: G.intel.slice(-20),
    gameOver: G.gameOver,
    war: G.war,
    warHistory: G.warHistory,
    scholars: G.scholars,
    idleScholars: G.idleScholars,
    warThreat: G.warThreat,
    taxRate: G.taxRate,
    vacantOffices: G.vacantOffices,
    envoyQueue: G.envoyQueue,
    activeDisaster: G.activeDisaster,
    tradeRoutes: G.tradeRoutes,
    examCycle: G.examCycle,
    examInvestment: G.examInvestment,
    prefPopulation: G.prefPopulation,
    trainingOrders: G.trainingOrders,
    spyMissions: G.spyMissions,
    intelRevealed: G.intelRevealed,
    heirs: G.heirs,
    crownPrinceId: G.crownPrinceId,
    successionCrisis: G.successionCrisis,
    // 可变数据：官员、军队、州郡、外交
    officials: {
      court:    COURT_OFFICIALS.map(o=>({ id:o.id, age:o.age, loyalty:o.loyalty, ability:o.ability })),
      civil:    CIVIL_OFFICIALS.map(o=>({ id:o.id, age:o.age, loyalty:o.loyalty, ability:o.ability })),
      military: MILITARY_OFFICIALS.map(o=>({ id:o.id, age:o.age, loyalty:o.loyalty, ability:o.ability })),
    },
    militaryUnits: MILITARY_UNITS.map(u=>({ ...u })),
    nations: NATIONS.map(n=>({ id:n.id, relation:n.relation, threat:n.threat, status:n.status, statusText:n.statusText, lastContact:n.lastContact })),
    prefectures: PREFECTURES.map(p=>({ id:p.id, morale:p.morale, development:p.development, defense:p.defense, troops:p.troops, grain:p.grain, tax:p.tax, population:p.population })),
  };
}

// ── 反序列化：把存档数据恢复到游戏状态 ──
function deserializeGame(data){
  if(!data || data.version !== 2) return false;
  G.turn          = data.turn;
  G.budget        = data.budget;
  G.budgetUsed    = data.budgetUsed;
  G.corruption    = data.corruption;
  G.taxIncome     = data.taxIncome;
  G.savings       = data.savings;
  G.energy        = data.energy;
  G.yearUsedActions = new Set(data.yearUsedActions || []);
  G.stats         = { ...data.stats };
  G.yearEvents    = data.yearEvents || [];
  G.usedEventIds  = new Set(data.usedEventIds || []);
  G.history       = data.history || [];
  G.intel         = data.intel || [];
  G.gameOver      = data.gameOver || false;
  G.war           = data.war || null;
  G.warHistory    = data.warHistory || [];
  G.scholars      = data.scholars || [];
  G.idleScholars  = data.idleScholars || [];
  G.warThreat     = data.warThreat || 0;
  G.taxRate       = data.taxRate || 'normal';
  G.vacantOffices = data.vacantOffices || [];
  G.envoyQueue    = data.envoyQueue || [];
  G.activeDisaster= data.activeDisaster || null;
  G.tradeRoutes   = data.tradeRoutes || [];
  G.examCycle     = data.examCycle || 0;
  G.examInvestment= data.examInvestment || 0;
  G.prefPopulation= data.prefPopulation || {};
  G.migrationDone = false;
  G.trainingOrders= data.trainingOrders || [];
  G.spyMissions   = data.spyMissions || [];
  G.intelRevealed = data.intelRevealed || {};
  G.heirs         = data.heirs || [];
  G.crownPrinceId = data.crownPrinceId || null;
  G.successionCrisis = data.successionCrisis || false;

  // 恢复官员可变属性
  if(data.officials){
    ['court','civil','military'].forEach(type=>{
      const arr = type==='court'?COURT_OFFICIALS:type==='civil'?CIVIL_OFFICIALS:MILITARY_OFFICIALS;
      (data.officials[type]||[]).forEach(saved=>{
        const o = arr.find(x=>x.id===saved.id);
        if(o){ o.age=saved.age; o.loyalty=saved.loyalty; o.ability=saved.ability; }
      });
    });
  }

  // 恢复军队
  if(data.militaryUnits){
    // 先清空再重建（支持新建军队的存档）
    MILITARY_UNITS.length = 0;
    data.militaryUnits.forEach(u=>MILITARY_UNITS.push({ ...u }));
  }

  // 恢复外交
  if(data.nations){
    data.nations.forEach(saved=>{
      const n = NATIONS.find(x=>x.id===saved.id);
      if(n){ n.relation=saved.relation; n.threat=saved.threat; n.status=saved.status; n.statusText=saved.statusText; n.lastContact=saved.lastContact||0; }
    });
  }

  // 恢复州郡
  if(data.prefectures){
    data.prefectures.forEach(saved=>{
      const p = PREFECTURES.find(x=>x.id===saved.id);
      if(p){ p.morale=saved.morale; p.development=saved.development; p.defense=saved.defense; p.troops=saved.troops; p.grain=saved.grain; p.tax=saved.tax; p.population=saved.population; }
    });
  }

  return true;
}

// ── 写入存档 ──
function writeSave(slot){
  try {
    const data = serializeGame();
    localStorage.setItem(SAVE_PREFIX + slot, JSON.stringify(data));
    return true;
  } catch(e) {
    console.error('存档失败', e);
    return false;
  }
}

// ── 读取存档元信息（不完整加载，只用于显示） ──
function readSaveMeta(slot){
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + slot);
    if(!raw) return null;
    const data = JSON.parse(raw);
    return {
      slot,
      turn: data.turn,
      savedAt: data.savedAt,
      stats: data.stats,
      savings: data.savings,
    };
  } catch(e){ return null; }
}

// ── 删除存档 ──
function deleteSave(slot){
  localStorage.removeItem(SAVE_PREFIX + slot);
}

// ── 自动存档（每年结束时调用） ──
function autoSave(){
  writeSave(AUTO_SLOT);
}

// ── 检查是否有自动存档（用于开始界面） ──
function hasAutoSave(){
  return !!localStorage.getItem(SAVE_PREFIX + AUTO_SLOT);
}

// ── 加载存档并进入游戏 ──
function loadSaveAndStart(slot){
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + slot);
    if(!raw){ showToast('存档不存在', 'warn'); return; }
    const data = JSON.parse(raw);
    if(!deserializeGame(data)){
      showToast('存档版本不兼容，无法读取', 'warn');
      return;
    }
    // 切换到游戏界面
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-screen').style.display  = 'flex';
    // 刷新所有UI
    renderMap();
    renderOfficialList();
    updateStats();
    renderActions();
    renderSysDetail(G.currentSystem || 'zhengwu');
    renderEventQueue();
    updateIntel();
    updateBudgetDisplay();
    updateEnergyDisplay();
    showIdleState();
    closeSaveModal();
    showToast(`📂 已读取存档：在位第${G.turn}年`, 'info');
  } catch(e){
    console.error('读档失败', e);
    showToast('读档失败，存档可能已损坏', 'warn');
  }
}

// ── 存档弹窗 ──
function openSaveModal(mode){
  // mode: 'save' | 'load'
  const isSave = mode === 'save';
  const title  = isSave ? '💾 保存存档' : '📂 读取存档';
  const slots  = [...SAVE_SLOTS, AUTO_SLOT];

  const slotHtml = slots.map(slot=>{
    const meta = readSaveMeta(slot);
    const isAuto = slot === AUTO_SLOT;
    const slotLabel = isAuto ? '自动存档' : `存档 ${slot}`;
    let content, actions;
    if(meta){
      const date = new Date(meta.savedAt);
      const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      const stats = meta.stats || {};
      content = `
        <div class="sv-slot-info">
          <div class="sv-slot-turn">在位第 ${meta.turn} 年</div>
          <div class="sv-slot-stats">
            <span>民心 ${stats.people||'?'}</span>
            <span>军力 ${stats.military||'?'}</span>
            <span>国库 ${meta.savings||0}万贯</span>
          </div>
          <div class="sv-slot-date">${dateStr} 存档</div>
        </div>`;
      if(isSave && !isAuto){
        actions = `
          <button class="sv-btn sv-btn-primary" onclick="confirmSave(${slot})">覆盖</button>
          <button class="sv-btn sv-btn-danger"  onclick="confirmDeleteSave(${slot})">删除</button>`;
      } else if(!isSave){
        actions = `<button class="sv-btn sv-btn-primary" onclick="loadSaveAndStart('${slot}')">读取</button>`;
        if(!isAuto) actions += `<button class="sv-btn sv-btn-danger" onclick="confirmDeleteSave(${slot})">删除</button>`;
      }
    } else {
      content = `<div class="sv-slot-empty">— 空档位 —</div>`;
      if(isSave && !isAuto){
        actions = `<button class="sv-btn sv-btn-primary" onclick="confirmSave(${slot})">存入</button>`;
      } else if(!isSave){
        actions = `<span class="sv-slot-empty-hint">无存档</span>`;
      }
    }
    return `
      <div class="sv-slot ${meta?'sv-slot-used':'sv-slot-empty-card'}" id="sv-slot-${slot}">
        <div class="sv-slot-label ${isAuto?'sv-auto-label':''}">${slotLabel}</div>
        <div class="sv-slot-body">${content}</div>
        <div class="sv-slot-actions">${actions||''}</div>
      </div>`;
  }).join('');

  const html = `
    <div class="sv-overlay" id="save-modal" onclick="if(event.target===this)closeSaveModal()">
      <div class="sv-box">
        <div class="sv-header">
          <span class="sv-title">${title}</span>
          <button class="sv-close" onclick="closeSaveModal()">✕</button>
        </div>
        <div class="sv-body">
          ${slotHtml}
        </div>
        <div class="sv-footer">
          <button class="sv-btn sv-btn-cancel" onclick="closeSaveModal()">关闭</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeSaveModal(){
  const el = document.getElementById('save-modal');
  if(el) el.remove();
}

function confirmSave(slot){
  const ok = writeSave(slot);
  closeSaveModal();
  if(ok){
    showToast(`💾 已保存到存档 ${slot}`, 'info');
  } else {
    showToast('存档失败，请检查浏览器存储权限', 'warn');
  }
}

function confirmDeleteSave(slot){
  if(!confirm(`确定删除存档 ${slot === AUTO_SLOT ? '（自动存档）' : slot}？此操作不可撤销。`)) return;
  deleteSave(slot);
  closeSaveModal();
  showToast('存档已删除', 'info');
}

// ── 开始界面：继续游戏（读自动存档） ──
function continueGame(){
  loadSaveAndStart(AUTO_SLOT);
}

// ── 开始界面：读取存档弹窗 ──
function openLoadModalFromStart(){
  openSaveModal('load');
}

// ===================================================
//  军事专属弹窗
// ===================================================

// ── 新建军队 ──────────────────────────────────────
function openNewArmyModal(){
  const remaining = G.budget - G.budgetUsed;
  if(remaining < 50){
    showToast('预算不足！新建军队至少需要50万贯', 'warn');
    return;
  }
  const locationOptions = ['杭州','越州','湖州','明州','台州','苏州','常州','润州','睦州','衢州','婺州','处州','温州'].map(
    loc => `<option value="${loc}">${loc}</option>`
  ).join('');
  const typeOptions = [
    { val:'步兵', label:'步兵军（擅长山地防守）' },
    { val:'骑兵', label:'骑兵军（擅长野战冲阵）' },
    { val:'水军', label:'水师（擅长水战海防）' },
    { val:'守备', label:'守备军（擅长城池防守）' },
    { val:'混编', label:'混编军（均衡全能）' }
  ].map(t=>`<option value="${t.val}">${t.label}</option>`).join('');

  const html = `
    <div class="mil-modal-overlay" id="new-army-modal" onclick="if(event.target===this)closeMilModal('new-army-modal')">
      <div class="mil-modal-box">
        <div class="mil-modal-header">
          <span class="mil-modal-icon">🏕️</span>
          <div>
            <div class="mil-modal-title">新建军队</div>
            <div class="mil-modal-sub">组建一支新的军队，需消耗大量钱粮</div>
          </div>
          <button class="mil-modal-close" onclick="closeMilModal('new-army-modal')">✕</button>
        </div>
        <div class="mil-modal-body">
          <div class="mil-form-row">
            <label class="mil-form-label">军队名称</label>
            <input class="mil-form-input" id="na-name" type="text" placeholder="如：定海军、威武军…" maxlength="8">
          </div>
          <div class="mil-form-row">
            <label class="mil-form-label">驻扎地点</label>
            <select class="mil-form-select" id="na-location">${locationOptions}</select>
          </div>
          <div class="mil-form-row">
            <label class="mil-form-label">军队类型</label>
            <select class="mil-form-select" id="na-type">${typeOptions}</select>
          </div>
          <div class="mil-form-row">
            <label class="mil-form-label">初始兵力</label>
            <div class="mil-slider-wrap">
              <input type="range" class="mil-slider" id="na-troops" min="2" max="15" value="5" oninput="document.getElementById('na-troops-val').textContent=this.value">
              <span class="mil-slider-val" id="na-troops-val">5</span><span class="mil-slider-unit">千人</span>
            </div>
          </div>
          <div class="mil-cost-hint">
            <span>💰 预计花费：</span>
            <span id="na-cost-preview" style="color:#c9a84c;font-weight:600">—</span>
            <span>（当前可用预算：${remaining}万贯）</span>
          </div>
        </div>
        <div class="mil-modal-footer">
          <button class="mil-btn-cancel" onclick="closeMilModal('new-army-modal')">取消</button>
          <button class="mil-btn-confirm" onclick="confirmNewArmy()">⚔️ 组建军队</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  // 动态计算花费
  const troopsSlider = document.getElementById('na-troops');
  const costPreview  = document.getElementById('na-cost-preview');
  function updateCost(){
    const t = parseInt(troopsSlider.value);
    const cost = 50 + t * 4;
    costPreview.textContent = `约${cost}万贯`;
    costPreview.style.color = cost <= remaining ? '#c9a84c' : '#e74c3c';
  }
  troopsSlider.addEventListener('input', updateCost);
  updateCost();
}

function closeMilModal(id){
  const el = document.getElementById(id);
  if(el) el.remove();
}

function confirmNewArmy(){
  const name     = document.getElementById('na-name').value.trim() || '新编军';
  const location = document.getElementById('na-location').value;
  const type     = document.getElementById('na-type').value;
  const troops   = parseInt(document.getElementById('na-troops').value);
  const cost     = 50 + troops * 4;
  const remaining = G.budget - G.budgetUsed;
  if(cost > remaining){
    showToast(`预算不足！组建${name}需要${cost}万贯，当前仅剩${remaining}万贯`, 'warn');
    return;
  }
  // 兵种构成预设
  const typePresets = {
    '步兵': { infantry:70, cavalry:5,  archers:20, navy:0,  engineers:5  },
    '骑兵': { infantry:20, cavalry:60, archers:10, navy:0,  engineers:10 },
    '水军': { infantry:20, cavalry:0,  archers:25, navy:50, engineers:5  },
    '守备': { infantry:75, cavalry:0,  archers:20, navy:0,  engineers:5  },
    '混编': { infantry:45, cavalry:20, archers:25, navy:0,  engineers:10 }
  };
  const preset = typePresets[type] || typePresets['混编'];
  const newUnit = {
    id: 'army_' + Date.now(),
    name, emoji:'🏕️', color:'#7f8c8d',
    location, locationEmoji:'📍',
    type, typeEmoji:'⚔️',
    role: `驻守${location}，新编军队`,
    troops, morale:60, supply:65, combat:55, training:50,
    commander: null, viceCommander: null,
    threat: 'none',
    desc: `新组建的${name}，驻扎于${location}，尚需磨合训练。`,
    ...preset,
    grain:70, equipment:60, horses: type==='骑兵'?troops*3:0,
    warships: type==='水军'?Math.floor(troops*3):0,
    specialties:[],
    battleRecord:{ wins:0, losses:0, draws:0 },
    status:'training', statusText:'训练中'
  };
  MILITARY_UNITS.push(newUnit);
  spendBudget(cost);
  closeMilModal('new-army-modal');
  renderSysDetail('junshi');
  addHistory(`组建${name}，驻扎${location}，花费${cost}万贯。`, 'good');
  showResult({
    icon:'🏕️', title:`${name}组建完成`,
    desc:`新编${name}已在${location}完成组建，共${troops}千人，以${type}为主。军队尚需时日磨合训练，方能形成战力。`,
    effects:{ military:+2 }, type:'good'
  }, ()=>showIdleState());
}

// ── 任命将领 ──────────────────────────────────────
function openAppointCmdModal(){
  const unitOptions = MILITARY_UNITS.map(u=>
    `<option value="${u.id}">${u.name}（${u.location}）</option>`
  ).join('');
  const officialOptions = MILITARY_OFFICIALS.map(o=>
    `<option value="${o.id}">${o.name} · ${o.role}（能力${o.ability}，忠诚${o.loyalty}）</option>`
  ).join('');

  const html = `
    <div class="mil-modal-overlay" id="appoint-cmd-modal" onclick="if(event.target===this)closeMilModal('appoint-cmd-modal')">
      <div class="mil-modal-box">
        <div class="mil-modal-header">
          <span class="mil-modal-icon">👑</span>
          <div>
            <div class="mil-modal-title">任命将领</div>
            <div class="mil-modal-sub">为各军指定主帅与副帅，将领能力影响军队战力</div>
          </div>
          <button class="mil-modal-close" onclick="closeMilModal('appoint-cmd-modal')">✕</button>
        </div>
        <div class="mil-modal-body">
          <div class="mil-form-row">
            <label class="mil-form-label">选择军队</label>
            <select class="mil-form-select" id="ac-unit" onchange="updateAppointPreview()">${unitOptions}</select>
          </div>
          <div id="ac-current-info" class="mil-appoint-current"></div>
          <div class="mil-form-row">
            <label class="mil-form-label">任命职位</label>
            <div class="mil-radio-group">
              <label class="mil-radio-label"><input type="radio" name="ac-pos" value="commander" checked onchange="updateAppointPreview()"> 主帅（都指挥使）</label>
              <label class="mil-radio-label"><input type="radio" name="ac-pos" value="viceCommander" onchange="updateAppointPreview()"> 副帅（副指挥使）</label>
            </div>
          </div>
          <div class="mil-form-row">
            <label class="mil-form-label">选择将领</label>
            <select class="mil-form-select" id="ac-official" onchange="updateAppointPreview()">${officialOptions}</select>
          </div>
          <div id="ac-preview" class="mil-appoint-preview"></div>
        </div>
        <div class="mil-modal-footer">
          <button class="mil-btn-cancel" onclick="closeMilModal('appoint-cmd-modal')">取消</button>
          <button class="mil-btn-confirm" onclick="confirmAppointCmd()">👑 确认任命</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  updateAppointPreview();
}

function updateAppointPreview(){
  const unitId = document.getElementById('ac-unit')?.value;
  const offId  = document.getElementById('ac-official')?.value;
  const pos    = document.querySelector('input[name="ac-pos"]:checked')?.value || 'commander';
  const unit   = MILITARY_UNITS.find(u=>u.id===unitId);
  const off    = MILITARY_OFFICIALS.find(o=>o.id===offId);
  if(!unit) return;
  const allOff = [...MILITARY_OFFICIALS];
  const curCmd  = allOff.find(o=>o.id===unit.commander);
  const curVcmd = allOff.find(o=>o.id===unit.viceCommander);
  const infoEl = document.getElementById('ac-current-info');
  if(infoEl) infoEl.innerHTML = `
    <div class="mil-appoint-info">
      <span>当前主帅：<b>${curCmd?curCmd.name:'空缺'}</b></span>
      <span>当前副帅：<b>${curVcmd?curVcmd.name:'空缺'}</b></span>
    </div>`;
  const prevEl = document.getElementById('ac-preview');
  if(prevEl && off) prevEl.innerHTML = `
    <div class="mil-appoint-preview-box">
      <div class="mil-prev-row"><span>将领：</span><b>${off.name}</b>（${off.role}）</div>
      <div class="mil-prev-row"><span>能力：</span><b style="color:${off.ability>=80?'#2ecc71':off.ability>=65?'#f39c12':'#e74c3c'}">${off.ability}</b></div>
      <div class="mil-prev-row"><span>忠诚：</span><b style="color:${off.loyalty>=80?'#2ecc71':off.loyalty>=65?'#f39c12':'#e74c3c'}">${off.loyalty}</b></div>
      <div class="mil-prev-row"><span>特长：</span><b>${off.skill}</b> · ${off.trait}</div>
      <div class="mil-prev-row" style="color:#7f8c8d;font-size:11px">${off.bio}</div>
    </div>`;
}

function confirmAppointCmd(){
  const unitId = document.getElementById('ac-unit').value;
  const offId  = document.getElementById('ac-official').value;
  const pos    = document.querySelector('input[name="ac-pos"]:checked').value;
  const unit   = MILITARY_UNITS.find(u=>u.id===unitId);
  const off    = MILITARY_OFFICIALS.find(o=>o.id===offId);
  if(!unit || !off){ showToast('请选择军队和将领', 'warn'); return; }
  const posLabel = pos==='commander'?'主帅':'副帅';
  unit[pos] = offId;
  // 将领能力影响战力
  const abilityBonus = Math.round((off.ability - 70) * 0.15);
  unit.combat = Math.max(10, Math.min(100, unit.combat + abilityBonus));
  closeMilModal('appoint-cmd-modal');
  renderSysDetail('junshi');
  addHistory(`任命${off.name}为${unit.name}${posLabel}。`, 'good');
  showResult({
    icon:'👑', title:'将领任命完成',
    desc:`${off.name}（${off.role}）已被任命为${unit.name}${posLabel}。其能力${off.ability}将对军队战力产生${abilityBonus>=0?'正面':'负面'}影响。`,
    effects: abilityBonus > 0 ? { military:+1 } : {},
    type: abilityBonus >= 0 ? 'good' : 'neutral'
  }, ()=>showIdleState());
}

// ── 划拨粮草 ──────────────────────────────────────
function openAllocSupplyModal(){
  const unitCards = MILITARY_UNITS.map(u=>{
    const grainColor = u.grain>=70?'#2ecc71':u.grain>=40?'#f39c12':'#e74c3c';
    const equipColor = u.equipment>=70?'#2ecc71':u.equipment>=40?'#f39c12':'#e74c3c';
    return `
      <div class="mil-alloc-card">
        <div class="mil-alloc-header">
          <span>${u.emoji} <b>${u.name}</b></span>
          <span style="color:#7f8c8d">${u.locationEmoji} ${u.location}</span>
        </div>
        <div class="mil-alloc-bars">
          <div class="mil-alloc-row">
            <span class="mil-alloc-label">粮草</span>
            <div class="syd-bar-wrap"><div class="syd-bar" style="width:${u.grain}%;background:${grainColor}"></div><span class="syd-bar-val">${u.grain}</span></div>
            <div class="mil-alloc-btns">
              <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','grain',-10)">-10</button>
              <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','grain',+10)">+10</button>
            </div>
          </div>
          <div class="mil-alloc-row">
            <span class="mil-alloc-label">装备</span>
            <div class="syd-bar-wrap"><div class="syd-bar" style="width:${u.equipment}%;background:${equipColor}"></div><span class="syd-bar-val">${u.equipment}</span></div>
            <div class="mil-alloc-btns">
              <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','equipment',-10)">-10</button>
              <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','equipment',+10)">+10</button>
            </div>
          </div>
          <div class="mil-alloc-row">
            <span class="mil-alloc-label">物资</span>
            <div class="syd-bar-wrap"><div class="syd-bar" style="width:${u.supply}%;background:${u.supply>=70?'#2ecc71':u.supply>=40?'#f39c12':'#e74c3c'}"></div><span class="syd-bar-val">${u.supply}</span></div>
            <div class="mil-alloc-btns">
              <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','supply',-10)">-10</button>
              <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','supply',+10)">+10</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  const html = `
    <div class="mil-modal-overlay" id="alloc-supply-modal" onclick="if(event.target===this)closeMilModal('alloc-supply-modal')">
      <div class="mil-modal-box mil-modal-wide">
        <div class="mil-modal-header">
          <span class="mil-modal-icon">🌾</span>
          <div>
            <div class="mil-modal-title">划拨粮草军械</div>
            <div class="mil-modal-sub">调整各军粮草、装备与物资储备（每次调整消耗5万贯）</div>
          </div>
          <button class="mil-modal-close" onclick="closeMilModal('alloc-supply-modal')">✕</button>
        </div>
        <div class="mil-modal-body">
          <div class="mil-cost-hint">💰 当前可用预算：<b style="color:#c9a84c">${G.budget - G.budgetUsed}万贯</b>　每次+10调整消耗5万贯</div>
          <div id="alloc-units-container">${unitCards}</div>
        </div>
        <div class="mil-modal-footer">
          <button class="mil-btn-cancel" onclick="closeMilModal('alloc-supply-modal')">关闭</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function adjustUnitStat(unitId, stat, delta){
  const unit = MILITARY_UNITS.find(u=>u.id===unitId);
  if(!unit) return;
  if(delta > 0){
    const cost = 5;
    if(G.budget - G.budgetUsed < cost){
      showToast('预算不足，无法继续划拨', 'warn');
      return;
    }
    spendBudget(cost);
  }
  unit[stat] = Math.max(0, Math.min(100, unit[stat] + delta));
  // 刷新弹窗内容
  const container = document.getElementById('alloc-units-container');
  if(container){
    const unitCards = MILITARY_UNITS.map(u=>{
      const grainColor = u.grain>=70?'#2ecc71':u.grain>=40?'#f39c12':'#e74c3c';
      const equipColor = u.equipment>=70?'#2ecc71':u.equipment>=40?'#f39c12':'#e74c3c';
      return `
        <div class="mil-alloc-card">
          <div class="mil-alloc-header">
            <span>${u.emoji} <b>${u.name}</b></span>
            <span style="color:#7f8c8d">${u.locationEmoji} ${u.location}</span>
          </div>
          <div class="mil-alloc-bars">
            <div class="mil-alloc-row">
              <span class="mil-alloc-label">粮草</span>
              <div class="syd-bar-wrap"><div class="syd-bar" style="width:${u.grain}%;background:${grainColor}"></div><span class="syd-bar-val">${u.grain}</span></div>
              <div class="mil-alloc-btns">
                <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','grain',-10)">-10</button>
                <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','grain',+10)">+10</button>
              </div>
            </div>
            <div class="mil-alloc-row">
              <span class="mil-alloc-label">装备</span>
              <div class="syd-bar-wrap"><div class="syd-bar" style="width:${u.equipment}%;background:${equipColor}"></div><span class="syd-bar-val">${u.equipment}</span></div>
              <div class="mil-alloc-btns">
                <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','equipment',-10)">-10</button>
                <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','equipment',+10)">+10</button>
              </div>
            </div>
            <div class="mil-alloc-row">
              <span class="mil-alloc-label">物资</span>
              <div class="syd-bar-wrap"><div class="syd-bar" style="width:${u.supply}%;background:${u.supply>=70?'#2ecc71':u.supply>=40?'#f39c12':'#e74c3c'}"></div><span class="syd-bar-val">${u.supply}</span></div>
              <div class="mil-alloc-btns">
                <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','supply',-10)">-10</button>
                <button class="mil-alloc-btn" onclick="adjustUnitStat('${u.id}','supply',+10)">+10</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
    container.innerHTML = unitCards;
    // 更新预算显示
    const hint = document.querySelector('#alloc-supply-modal .mil-cost-hint');
    if(hint) hint.innerHTML = `💰 当前可用预算：<b style="color:#c9a84c">${G.budget - G.budgetUsed}万贯</b>　每次+10调整消耗5万贯`;
  }
}

// ── 规划兵种 ──────────────────────────────────────
function openPlanTroopsModal(){
  const remaining = G.budget - G.budgetUsed;
  if(remaining < 10){
    showToast('预算不足！规划兵种至少需要10万贯', 'warn');
    return;
  }
  const unitOptions = MILITARY_UNITS.map(u=>
    `<option value="${u.id}">${u.name}（${u.location}）</option>`
  ).join('');

  const html = `
    <div class="mil-modal-overlay" id="plan-troops-modal" onclick="if(event.target===this)closeMilModal('plan-troops-modal')">
      <div class="mil-modal-box">
        <div class="mil-modal-header">
          <span class="mil-modal-icon">🗺️</span>
          <div>
            <div class="mil-modal-title">规划兵种构成</div>
            <div class="mil-modal-sub">调整军队兵种比例，优化战术配置（花费10万贯）</div>
          </div>
          <button class="mil-modal-close" onclick="closeMilModal('plan-troops-modal')">✕</button>
        </div>
        <div class="mil-modal-body">
          <div class="mil-form-row">
            <label class="mil-form-label">选择军队</label>
            <select class="mil-form-select" id="pt-unit" onchange="updatePlanTroopsPreview()">${unitOptions}</select>
          </div>
          <div id="pt-sliders" class="mil-troop-sliders"></div>
          <div id="pt-total-hint" class="mil-troop-total"></div>
        </div>
        <div class="mil-modal-footer">
          <button class="mil-btn-cancel" onclick="closeMilModal('plan-troops-modal')">取消</button>
          <button class="mil-btn-confirm" onclick="confirmPlanTroops()">🗺️ 确认调整</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  updatePlanTroopsPreview();
}

function updatePlanTroopsPreview(){
  const unitId = document.getElementById('pt-unit')?.value;
  const unit   = MILITARY_UNITS.find(u=>u.id===unitId);
  if(!unit) return;
  const types = [
    { key:'infantry', label:'步兵', color:'#e74c3c', icon:'🚶' },
    { key:'cavalry',  label:'骑兵', color:'#c9a84c', icon:'🐴' },
    { key:'archers',  label:'弓弩手', color:'#2ecc71', icon:'🏹' },
    { key:'navy',     label:'水军', color:'#3498db', icon:'⛵' },
    { key:'engineers',label:'辎重兵', color:'#9b59b6', icon:'⚙️' }
  ];
  const slidersHtml = types.map(t=>`
    <div class="mil-troop-slider-row">
      <span class="mil-ts-icon">${t.icon}</span>
      <span class="mil-ts-label" style="color:${t.color}">${t.label}</span>
      <input type="range" class="mil-slider" id="pt-${t.key}" min="0" max="100" value="${unit[t.key]||0}"
        oninput="document.getElementById('pt-${t.key}-val').textContent=this.value;updatePlanTroopsTotal()">
      <span class="mil-slider-val" id="pt-${t.key}-val">${unit[t.key]||0}</span><span class="mil-slider-unit">%</span>
    </div>`).join('');
  document.getElementById('pt-sliders').innerHTML = slidersHtml;
  updatePlanTroopsTotal();
}

function updatePlanTroopsTotal(){
  const keys = ['infantry','cavalry','archers','navy','engineers'];
  const total = keys.reduce((s,k)=>{
    const el = document.getElementById(`pt-${k}`);
    return s + (el ? parseInt(el.value) : 0);
  }, 0);
  const hint = document.getElementById('pt-total-hint');
  if(hint){
    const ok = total === 100;
    hint.innerHTML = `合计：<b style="color:${ok?'#2ecc71':'#e74c3c'}">${total}%</b>${ok?' ✓ 合计恰好100%':' ⚠ 合计须为100%'}`;
  }
}

function confirmPlanTroops(){
  const unitId = document.getElementById('pt-unit').value;
  const unit   = MILITARY_UNITS.find(u=>u.id===unitId);
  if(!unit){ showToast('请选择军队', 'warn'); return; }
  const keys = ['infantry','cavalry','archers','navy','engineers'];
  const vals = {};
  let total = 0;
  keys.forEach(k=>{
    const el = document.getElementById(`pt-${k}`);
    vals[k] = el ? parseInt(el.value) : 0;
    total += vals[k];
  });
  if(total !== 100){
    showToast(`兵种比例合计须为100%，当前为${total}%`, 'warn');
    return;
  }
  const cost = 10;
  if(G.budget - G.budgetUsed < cost){
    showToast('预算不足', 'warn');
    return;
  }
  keys.forEach(k=>{ unit[k] = vals[k]; });
  spendBudget(cost);
  G.yearUsedActions.add('plan_troops');
  closeMilModal('plan-troops-modal');
  renderSysDetail('junshi');
  addHistory(`调整${unit.name}兵种构成，花费${cost}万贯。`, 'good');
  showResult({
    icon:'🗺️', title:'兵种调整完成',
    desc:`${unit.name}的兵种构成已按新方案调整：步兵${vals.infantry}%、骑兵${vals.cavalry}%、弓弩${vals.archers}%、水军${vals.navy}%、辎重${vals.engineers}%。新的战术配置将在下次演练后充分发挥效果。`,
    effects:{ military:+1 }, type:'good'
  }, ()=>showIdleState());
}

// ===================================================
//  新A项：科举升级系统
// ===================================================

// 科举投入档次配置
const EXAM_INVEST_TIERS = [
  { id:'none',   label:'不额外投入', cost:0,  qualityBonus:0,  countBonus:0,  desc:'按惯例举行，士子质量一般' },
  { id:'modest', label:'适度投入',   cost:15, qualityBonus:8,  countBonus:1,  desc:'增加考场、延请名师，士子质量有所提升' },
  { id:'lavish', label:'重金投入',   cost:35, qualityBonus:18, countBonus:2,  desc:'广开恩科、重金延师，吸引天下英才赴考' },
  { id:'grand',  label:'盛世恩科',   cost:60, qualityBonus:30, countBonus:3,  desc:'大开恩科、遍访名士，此届必出栋梁之才' },
];

// 检查科举周期（每3年自动触发）
function _checkExamCycle(){
  G.examCycle = (G.examCycle || 0) + 1;
  if(G.examCycle >= 3){
    G.examCycle = 0;
    // 触发科举弹窗（加入事件队列，年初处理）
    G.yearEvents.unshift({
      id: `exam_auto_${G.turn}`,
      tag: 'culture', tagText: '科举',
      title: `第${yearStr(G.turn)}年科举开科`,
      scene: `三年一届的科举之期已至，礼部奏请开科取士，广纳天下英才为国效力。大王可决定本届科举的投入规模，以影响士子质量。`,
      desc: '',
      choices: EXAM_INVEST_TIERS.map(tier=>({
        label: `【${tier.label}】`,
        text: tier.desc + (tier.cost>0?`（花费${tier.cost}万贯）`:''),
        effect: tier.cost>0 ? { culture: Math.round(tier.qualityBonus/3) } : {},
        onConfirm: ()=>{
          if(tier.cost > 0){
            if(G.budget - G.budgetUsed < tier.cost){
              showToast('预算不足，改为不额外投入', 'warn');
              G.examInvestment = 0;
            } else {
              spendBudget(tier.cost);
              G.examInvestment = tier.id;
            }
          } else {
            G.examInvestment = 'none';
          }
          // 延迟触发科举弹窗
          setTimeout(()=>openExamModalEnhanced(), 300);
        },
        result: { icon:'📜', title:`${tier.label}科举`, desc:`本届科举${tier.desc}，即将放榜。`, type:'neutral' }
      })),
    });
    addHistory(`📜 三年科举之期已至，礼部奏请开科取士。`, 'good');
  }
}

// 增强版科举弹窗（支持投入加成）
function openExamModalEnhanced(){
  const tier = EXAM_INVEST_TIERS.find(t=>t.id===G.examInvestment) || EXAM_INVEST_TIERS[0];
  const baseCount = 3 + Math.floor(G.stats.culture/25);
  const count = baseCount + tier.countBonus;
  const cheatChance = Math.max(0, 0.15 - G.stats.culture*0.001 - (tier.qualityBonus*0.002));
  const cheated = Math.random() < cheatChance;

  G.scholars = [];
  for(let i=0;i<count;i++) G.scholars.push(generateScholarEnhanced(tier.qualityBonus));

  const sub = document.getElementById('exam-modal-sub');
  const vacantCount = getVacantSlots().length;
  const tierLabel = tier.id!=='none' ? `（${tier.label}，质量加成+${tier.qualityBonus}）` : '';

  sub.textContent = cheated
    ? `⚠️ 本届科举发现舞弊迹象！共录取 ${count} 名士子${tierLabel}，当前空缺官职 ${vacantCount} 个`
    : `本届共录取 ${count} 名士子${tierLabel}，当前空缺官职 ${vacantCount} 个，请大王为每位进士钦点官职`;

  if(cheated){
    applyEffects({culture:-4, people:-3});
    addHistory('科举发现舞弊，文治声誉受损','bad');
  } else {
    applyEffects({culture:+5 + Math.round(tier.qualityBonus/5)});
  }

  renderExamScholarsEnhanced();
  document.getElementById('exam-modal').classList.add('show');
}

// 增强版士子生成（带质量加成和专长匹配空缺）
function generateScholarEnhanced(qualityBonus){
  const s = generateScholar();
  s.ability = Math.min(98, s.ability + Math.round(qualityBonus * (0.5 + Math.random()*0.5)));
  // 检查是否有对应专长的空缺，若有则标记推荐
  const vacants = getVacantSlots();
  const matchedSlots = vacants.filter(sl=>sl.skillPref.includes(s.skill));
  s.recommendedSlot = matchedSlots.length > 0 ? matchedSlots[0].id : null;
  s.recommendedSlotTitle = matchedSlots.length > 0 ? matchedSlots[0].title : null;
  return s;
}

// 增强版科举渲染（显示推荐职位）
function renderExamScholarsEnhanced(){
  const body = document.getElementById('exam-modal-body');
  if(!body){ renderExamScholars(); return; }

  const vacant = getVacantSlots();
  const takenSlots = ()=> new Set(G.scholars.map(s=>s.assignedSlot).filter(Boolean));

  body.innerHTML = G.scholars.map((s,i)=>{
    const rankColor = s.rank==='状元'?'#e8c97a':s.rank==='榜眼'?'#c0c0c0':s.rank==='探花'?'#cd7f32':'var(--text-dim)';
    const taken = takenSlots();
    const buildGroup = (cat, label) => {
      const slots = vacant.filter(sl=>sl.category===cat).sort((a,b)=>a.rank-b.rank);
      if(slots.length===0) return '';
      const opts = slots.map(slot=>{
        const isMe = slot.id===s.assignedSlot;
        const isTaken = !isMe && taken.has(slot.id);
        const matchMark = slot.skillPref.includes(s.skill) ? '★' : '　';
        const rankStr = RANK_LABEL[slot.rank]||`${slot.rank}品`;
        const prefix = isTaken ? '[已选] ' : '';
        return `<option value="${slot.id}" ${isMe?'selected':''} ${isTaken?'disabled':''}>
          ${prefix}${matchMark} [${rankStr}] ${slot.title}
        </option>`;
      }).join('');
      return `<optgroup label="── ${label} ──">${opts}</optgroup>`;
    };
    const options = buildGroup('court','朝廷') + buildGroup('civil','州郡') + buildGroup('military','军队');
    const selectedSlot = s.assignedSlot ? OFFICE_ROSTER.find(sl=>sl.id===s.assignedSlot) : null;
    const slotDesc = selectedSlot
      ? `<div class="esc-slot-desc">${selectedSlot.emoji} ${selectedSlot.desc}</div>`
      : `<div class="esc-slot-desc" style="color:var(--text-muted)">选择赋闲则暂不授职，可日后启用</div>`;
    // 推荐标签
    const recTag = s.recommendedSlotTitle
      ? `<span class="esc-tag" style="background:rgba(201,168,76,0.2);color:#c9a84c">💡推荐：${s.recommendedSlotTitle}</span>`
      : '';

    return `<div class="exam-scholar-card" id="esc-${i}">
      <div class="esc-avatar">${s.emoji}</div>
      <div class="esc-info">
        <div class="esc-name">${s.name} <span style="font-size:10px;color:${rankColor};font-weight:700">${s.rank}</span></div>
        <div class="esc-tags">
          <span class="esc-tag skill">专长：${s.skill}</span>
          <span class="esc-tag ability">能力：${s.ability}</span>
          <span class="esc-tag">年龄：${s.age}岁</span>
          <span class="esc-tag">${s.trait}</span>
          ${recTag}
        </div>
        <div class="esc-assign-row">
          <select class="esc-slot-select" onchange="setScholarSlot(${i},this.value)">
            <option value="">⬜ 暂不授职（赋闲）</option>
            ${options}
          </select>
        </div>
        ${slotDesc}
      </div>
    </div>`;
  }).join('');
}

// ===================================================
//  新B项：人口发展系统
// ===================================================

// 各州人口自然增长（差异化）
function _doPopulationGrowth(){
  if(!G.prefPopulation) G.prefPopulation = {};
  let totalGrowth = 0;
  PREFECTURES.forEach(p=>{
    const base = G.prefPopulation[p.id] || p.population || 20;
    // 增长率：受民心、农业、稳定度影响，各州略有差异
    const moraleBonus = (p.morale - 50) / 500;
    const agriBonus = (G.stats.agri - 50) / 500;
    const stabilityBonus = (G.stats.stability - 50) / 1000;
    const rate = 0.008 + moraleBonus + agriBonus + stabilityBonus + (Math.random()*0.004 - 0.002);
    const growth = Math.max(0, Math.round(base * rate));
    G.prefPopulation[p.id] = base + growth;
    totalGrowth += growth;
  });
  // 同步总人口
  const totalPop = Object.values(G.prefPopulation).reduce((s,v)=>s+v, 0);
  G.stats.population = totalPop;
  if(totalGrowth > 0){
    addHistory(`👥 各州人口自然增长，合计增加${totalGrowth}万人，总人口${totalPop}万。`, 'good');
  }
}

// 移民实边弹窗
function openMigrationModal(){
  if(G.migrationDone){
    showToast('本年已执行过移民实边，请明年再来', 'warn');
    return;
  }
  const remaining = G.budget - G.budgetUsed;
  if(remaining < 20){
    showToast('预算不足！移民实边至少需要20万贯', 'warn');
    return;
  }

  // 计算各州人口密度（人口/发展度）
  const prefData = PREFECTURES.map(p=>{
    const pop = G.prefPopulation[p.id] || p.population || 20;
    const density = pop / Math.max(1, p.development);
    return { ...p, pop, density };
  }).sort((a,b)=>b.density - a.density);

  const sourceOptions = prefData.slice(0,5).map(p=>
    `<option value="${p.id}">${p.name}（人口${p.pop}万，密度${p.density.toFixed(1)}）</option>`
  ).join('');
  const targetOptions = prefData.slice(-5).reverse().map(p=>
    `<option value="${p.id}">${p.name}（人口${p.pop}万，发展${p.development}）</option>`
  ).join('');

  const html = `
    <div class="mil-modal-overlay" id="migration-modal" onclick="if(event.target===this)closeMilModal('migration-modal')">
      <div class="mil-modal-box">
        <div class="mil-modal-header">
          <span class="mil-modal-icon">👥</span>
          <div>
            <div class="mil-modal-title">移民实边</div>
            <div class="mil-modal-sub">将人口稠密州的百姓迁往边境稀疏州，开发边疆</div>
          </div>
          <button class="mil-modal-close" onclick="closeMilModal('migration-modal')">✕</button>
        </div>
        <div class="mil-modal-body">
          <div class="mil-form-row">
            <label class="mil-form-label">迁出地（人口稠密）</label>
            <select class="mil-form-select" id="mg-source">${sourceOptions}</select>
          </div>
          <div class="mil-form-row">
            <label class="mil-form-label">迁入地（边境稀疏）</label>
            <select class="mil-form-select" id="mg-target">${targetOptions}</select>
          </div>
          <div class="mil-form-row">
            <label class="mil-form-label">迁移规模</label>
            <div class="mil-slider-wrap">
              <input type="range" class="mil-slider" id="mg-amount" min="1" max="10" value="3"
                oninput="document.getElementById('mg-amount-val').textContent=this.value">
              <span class="mil-slider-val" id="mg-amount-val">3</span><span class="mil-slider-unit">万人</span>
            </div>
          </div>
          <div class="mil-cost-hint">💰 每迁移1万人花费5万贯，当前可用：<b style="color:#c9a84c">${remaining}万贯</b></div>
        </div>
        <div class="mil-modal-footer">
          <button class="mil-btn-cancel" onclick="closeMilModal('migration-modal')">取消</button>
          <button class="mil-btn-confirm" onclick="confirmMigration()">👥 执行移民</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function confirmMigration(){
  const sourceId = document.getElementById('mg-source').value;
  const targetId = document.getElementById('mg-target').value;
  const amount   = parseInt(document.getElementById('mg-amount').value);
  if(sourceId === targetId){ showToast('迁出地和迁入地不能相同', 'warn'); return; }
  const cost = amount * 5;
  if(G.budget - G.budgetUsed < cost){ showToast('预算不足', 'warn'); return; }

  const sourcePref = PREFECTURES.find(p=>p.id===sourceId);
  const targetPref = PREFECTURES.find(p=>p.id===targetId);
  if(!sourcePref || !targetPref) return;

  const sourcePop = G.prefPopulation[sourceId] || sourcePref.population || 20;
  if(sourcePop <= amount + 5){ showToast('迁出地人口不足', 'warn'); return; }

  G.prefPopulation[sourceId] = sourcePop - amount;
  G.prefPopulation[targetId] = (G.prefPopulation[targetId] || targetPref.population || 20) + amount;
  spendBudget(cost);
  G.migrationDone = true;

  // 迁入地发展度提升
  targetPref.development = Math.min(100, targetPref.development + Math.round(amount * 0.8));
  targetPref.morale = Math.max(0, targetPref.morale - 5); // 移民初期民心略降

  const effects = { agri:+2, people:-1, stability:+1 };
  applyEffects(effects);
  closeMilModal('migration-modal');
  addHistory(`👥 移民实边：从${sourcePref.name}迁移${amount}万人至${targetPref.name}，花费${cost}万贯。${targetPref.name}发展度提升。`, 'good');
  showResult({
    icon:'👥', title:'移民实边完成',
    desc:`大王下令从${sourcePref.name}迁移${amount}万百姓至${targetPref.name}，开发边疆。移民初期生活艰苦，但长远来看将大大促进边境地区的农业开发与人口繁衍。`,
    effects, type:'good'
  }, ()=>showIdleState());
}

// ===================================================
//  新C项：军队训练系统
// ===================================================

// 开启训练命令弹窗
function openTrainArmyModal(){
  const remaining = G.budget - G.budgetUsed;
  const unitOptions = MILITARY_UNITS
    .filter(u=>u.status!=='battle')
    .map(u=>{
      const isTraining = (G.trainingOrders||[]).find(o=>o.unitId===u.id);
      const label = isTraining ? `${u.name}（训练中，剩余${isTraining.turns}年）` : `${u.name}（${u.location}，训练度${u.training}）`;
      return `<option value="${u.id}" ${isTraining?'disabled':''}>${label}</option>`;
    }).join('');

  const html = `
    <div class="mil-modal-overlay" id="train-army-modal" onclick="if(event.target===this)closeMilModal('train-army-modal')">
      <div class="mil-modal-box">
        <div class="mil-modal-header">
          <span class="mil-modal-icon">🏋️</span>
          <div>
            <div class="mil-modal-title">下令训练</div>
            <div class="mil-modal-sub">消耗粮草提升军队训练度与战斗力，训练期间不可出征</div>
          </div>
          <button class="mil-modal-close" onclick="closeMilModal('train-army-modal')">✕</button>
        </div>
        <div class="mil-modal-body">
          <div class="mil-form-row">
            <label class="mil-form-label">选择军队</label>
            <select class="mil-form-select" id="ta-unit" onchange="updateTrainPreview()">${unitOptions}</select>
          </div>
          <div class="mil-form-row">
            <label class="mil-form-label">训练强度</label>
            <div class="mil-radio-group">
              <label class="mil-radio-label"><input type="radio" name="ta-intensity" value="light" checked onchange="updateTrainPreview()"> 轻度训练（1年，粮草-10，训练度+8，战力+3）</label>
              <label class="mil-radio-label"><input type="radio" name="ta-intensity" value="normal" onchange="updateTrainPreview()"> 正常训练（2年，粮草-20，训练度+18，战力+7）</label>
              <label class="mil-radio-label"><input type="radio" name="ta-intensity" value="intensive" onchange="updateTrainPreview()"> 强化训练（3年，粮草-35，训练度+30，战力+12）</label>
            </div>
          </div>
          <div id="ta-preview" class="mil-appoint-preview" style="margin-top:8px"></div>
          <div class="mil-cost-hint">⚠️ 训练期间该军队无法出征作战！</div>
        </div>
        <div class="mil-modal-footer">
          <button class="mil-btn-cancel" onclick="closeMilModal('train-army-modal')">取消</button>
          <button class="mil-btn-confirm" onclick="confirmTrainArmy()">🏋️ 开始训练</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  updateTrainPreview();
}

const TRAIN_INTENSITY_CONFIG = {
  light:     { turns:1, grainCost:10, trainingGain:8,  combatGain:3,  moraleGain:5,  label:'轻度训练' },
  normal:    { turns:2, grainCost:20, trainingGain:18, combatGain:7,  moraleGain:8,  label:'正常训练' },
  intensive: { turns:3, grainCost:35, trainingGain:30, combatGain:12, moraleGain:12, label:'强化训练' },
};

function updateTrainPreview(){
  const unitId = document.getElementById('ta-unit')?.value;
  const intensity = document.querySelector('input[name="ta-intensity"]:checked')?.value || 'light';
  const unit = MILITARY_UNITS.find(u=>u.id===unitId);
  const cfg = TRAIN_INTENSITY_CONFIG[intensity];
  const prev = document.getElementById('ta-preview');
  if(!prev || !unit || !cfg) return;
  const newTraining = Math.min(100, unit.training + cfg.trainingGain);
  const newCombat   = Math.min(100, unit.combat   + cfg.combatGain);
  prev.innerHTML = `
    <div class="mil-appoint-preview-box">
      <div class="mil-prev-row"><span>军队：</span><b>${unit.emoji} ${unit.name}</b></div>
      <div class="mil-prev-row"><span>训练度：</span><b>${unit.training}</b> → <b style="color:#2ecc71">${newTraining}</b></div>
      <div class="mil-prev-row"><span>战斗力：</span><b>${unit.combat}</b> → <b style="color:#2ecc71">${newCombat}</b></div>
      <div class="mil-prev-row"><span>粮草消耗：</span><b style="color:#e74c3c">-${cfg.grainCost}</b>（训练期间每年扣除）</div>
      <div class="mil-prev-row"><span>训练周期：</span><b>${cfg.turns}年</b>（完成后自动恢复待命）</div>
    </div>`;
}

function confirmTrainArmy(){
  const unitId    = document.getElementById('ta-unit').value;
  const intensity = document.querySelector('input[name="ta-intensity"]:checked').value;
  const unit = MILITARY_UNITS.find(u=>u.id===unitId);
  const cfg  = TRAIN_INTENSITY_CONFIG[intensity];
  if(!unit || !cfg){ showToast('请选择军队', 'warn'); return; }
  if((G.trainingOrders||[]).find(o=>o.unitId===unitId)){
    showToast('该军队已在训练中', 'warn'); return;
  }
  if(unit.grain < cfg.grainCost){
    showToast(`粮草不足！${cfg.label}需要粮草${cfg.grainCost}，当前${unit.grain}`, 'warn'); return;
  }

  // 扣除首年粮草
  unit.grain = Math.max(0, unit.grain - cfg.grainCost);
  unit.status = 'training';
  unit.statusText = `训练中(${cfg.turns}年)`;

  G.trainingOrders = G.trainingOrders || [];
  G.trainingOrders.push({
    unitId, intensity,
    turns: cfg.turns,
    grainCostPerYear: cfg.grainCost,
    trainingGain: cfg.trainingGain,
    combatGain: cfg.combatGain,
    moraleGain: cfg.moraleGain,
    startTurn: G.turn,
  });

  closeMilModal('train-army-modal');
  renderSysDetail('junshi');
  addHistory(`🏋️ ${unit.name}开始${cfg.label}，预计${cfg.turns}年后完成，训练期间不可出征。`, 'good');
  showResult({
    icon:'🏋️', title:'训练命令下达',
    desc:`${unit.name}已进入${cfg.label}状态。将士们日夜操练，${cfg.turns}年后训练度将提升${cfg.trainingGain}，战斗力提升${cfg.combatGain}。训练期间该军队无法出征。`,
    effects:{ military:+1 }, type:'good'
  }, ()=>showIdleState());
}

// 年度训练进度推进
function _advanceTrainingOrders(){
  if(!G.trainingOrders || G.trainingOrders.length===0) return;
  const completed = [];
  G.trainingOrders.forEach(order=>{
    const unit = MILITARY_UNITS.find(u=>u.id===order.unitId);
    if(!unit){ completed.push(order); return; }
    // 扣除粮草
    if(unit.grain >= order.grainCostPerYear){
      unit.grain = Math.max(0, unit.grain - order.grainCostPerYear);
    } else {
      // 粮草不足，训练中断
      unit.status = 'standby';
      unit.statusText = '待命';
      addHistory(`⚠️ ${unit.name}粮草不足，训练中断！`, 'bad');
      completed.push(order);
      return;
    }
    order.turns--;
    if(order.turns <= 0){
      // 训练完成
      unit.training = Math.min(100, unit.training + order.trainingGain);
      unit.combat   = Math.min(100, unit.combat   + order.combatGain);
      unit.morale   = Math.min(100, unit.morale   + order.moraleGain);
      unit.status = 'standby';
      unit.statusText = '待命';
      addHistory(`✅ ${unit.name}训练完成！训练度+${order.trainingGain}，战力+${order.combatGain}，士气+${order.moraleGain}。`, 'good');
      applyEffects({ military:+3 });
      showToast(`🏋️ ${unit.name}训练完成！战力大幅提升！`, 'info');
      completed.push(order);
    } else {
      unit.statusText = `训练中(剩${order.turns}年)`;
    }
  });
  G.trainingOrders = G.trainingOrders.filter(o=>!completed.includes(o));
}

// ===================================================
//  新D项：情报细作系统
// ===================================================

// 细作任务配置
const SPY_MISSION_TYPES = [
  {
    id:'troop_count', label:'刺探兵力', icon:'⚔️',
    cost:10, risk:0.20, turns:1,
    desc:'派细作潜入敌境，刺探其真实兵力与战斗力',
    reveal: (n)=>({ troops: n.troops||'未知', combat: n.combat||'未知' }),
    successText: (n,r)=>`成功刺探${n.name}兵力：约${r.troops}千人，战力约${r.combat}。`,
  },
  {
    id:'internal_affairs', label:'探查内政', icon:'🏛️',
    cost:12, risk:0.15, turns:1,
    desc:'探查邻国内政状况、民心与稳定度',
    reveal: (n)=>({ people: n.people||'未知', stability: n.stability||'未知' }),
    successText: (n,r)=>`成功探查${n.name}内政：民心约${r.people}，稳定度约${r.stability}。`,
  },
  {
    id:'sow_discord', label:'散布谣言', icon:'💬',
    cost:20, risk:0.30, turns:1,
    desc:'在敌国散布谣言，降低其民心与稳定度',
    reveal: ()=>({}),
    successText: (n)=>`细作在${n.name}成功散布谣言，其国内人心惶惶。`,
    onSuccess: (n)=>{ applyEffects({prestige:+3}); const nat=NATIONS.find(x=>x.id===n.id); if(nat) nat.relation=Math.max(0,nat.relation-5); },
  },
  {
    id:'steal_tech', label:'窃取技术', icon:'📜',
    cost:25, risk:0.35, turns:2,
    desc:'派遣细作潜伏，窃取邻国农业或军事技术',
    reveal: ()=>({}),
    successText: (n)=>`细作从${n.name}成功窃取技术，吴越受益匪浅。`,
    onSuccess: ()=>{ applyEffects({agri:+4, military:+2}); },
  },
];

// 派遣细作弹窗
function openSpyModal(){
  const remaining = G.budget - G.budgetUsed;
  const activeMissions = (G.spyMissions||[]).filter(m=>m.status==='active');

  const nationOptions = NATIONS.filter(n=>n.id!=='wuyue_self').map(n=>{
    const revealed = G.intelRevealed[n.id];
    const revealedText = revealed ? ` [已有情报]` : '';
    return `<option value="${n.id}">${n.emoji} ${n.name}${revealedText}</option>`;
  }).join('');

  const missionOptions = SPY_MISSION_TYPES.map(m=>
    `<option value="${m.id}">${m.icon} ${m.label}（花费${m.cost}万贯，风险${Math.round(m.risk*100)}%）</option>`
  ).join('');

  const activeMissionHtml = activeMissions.length > 0
    ? `<div style="margin-bottom:10px;padding:8px;background:rgba(0,0,0,0.2);border-radius:4px;font-size:11px">
        <div style="color:#c9a84c;margin-bottom:4px">📋 进行中的任务：</div>
        ${activeMissions.map(m=>`<div>• ${m.missionLabel} → ${m.targetName}（剩余${m.turnsLeft}年）</div>`).join('')}
      </div>` : '';

  const html = `
    <div class="mil-modal-overlay" id="spy-modal" onclick="if(event.target===this)closeMilModal('spy-modal')">
      <div class="mil-modal-box">
        <div class="mil-modal-header">
          <span class="mil-modal-icon">🕵️</span>
          <div>
            <div class="mil-modal-title">派遣细作</div>
            <div class="mil-modal-sub">向邻国派遣细作，获取情报或实施秘密行动</div>
          </div>
          <button class="mil-modal-close" onclick="closeMilModal('spy-modal')">✕</button>
        </div>
        <div class="mil-modal-body">
          ${activeMissionHtml}
          <div class="mil-form-row">
            <label class="mil-form-label">目标国家</label>
            <select class="mil-form-select" id="spy-nation">${nationOptions}</select>
          </div>
          <div class="mil-form-row">
            <label class="mil-form-label">任务类型</label>
            <select class="mil-form-select" id="spy-mission" onchange="updateSpyPreview()">${missionOptions}</select>
          </div>
          <div id="spy-preview" class="mil-appoint-preview" style="margin-top:8px"></div>
          <div class="mil-cost-hint">💰 当前可用预算：<b style="color:#c9a84c">${remaining}万贯</b></div>
        </div>
        <div class="mil-modal-footer">
          <button class="mil-btn-cancel" onclick="closeMilModal('spy-modal')">取消</button>
          <button class="mil-btn-confirm" onclick="confirmSendSpy()">🕵️ 派遣细作</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  updateSpyPreview();
}

function updateSpyPreview(){
  const missionId = document.getElementById('spy-mission')?.value;
  const cfg = SPY_MISSION_TYPES.find(m=>m.id===missionId);
  const prev = document.getElementById('spy-preview');
  if(!prev || !cfg) return;
  prev.innerHTML = `
    <div class="mil-appoint-preview-box">
      <div class="mil-prev-row"><span>${cfg.icon} 任务：</span><b>${cfg.label}</b></div>
      <div class="mil-prev-row"><span>说明：</span>${cfg.desc}</div>
      <div class="mil-prev-row"><span>花费：</span><b style="color:#c9a84c">${cfg.cost}万贯</b></div>
      <div class="mil-prev-row"><span>风险：</span><b style="color:${cfg.risk>=0.3?'#e74c3c':'#f39c12'}">${Math.round(cfg.risk*100)}%被发现</b></div>
      <div class="mil-prev-row"><span>周期：</span><b>${cfg.turns}年后出结果</b></div>
    </div>`;
}

function confirmSendSpy(){
  const nationId  = document.getElementById('spy-nation').value;
  const missionId = document.getElementById('spy-mission').value;
  const nation = NATIONS.find(n=>n.id===nationId);
  const cfg    = SPY_MISSION_TYPES.find(m=>m.id===missionId);
  if(!nation || !cfg){ showToast('请选择目标和任务', 'warn'); return; }
  if(G.budget - G.budgetUsed < cfg.cost){ showToast('预算不足', 'warn'); return; }

  spendBudget(cfg.cost);
  G.spyMissions = G.spyMissions || [];
  G.spyMissions.push({
    id: `spy_${Date.now()}`,
    targetId: nationId,
    targetName: nation.name,
    missionId,
    missionLabel: cfg.label,
    risk: cfg.risk,
    turnsLeft: cfg.turns,
    status: 'active',
  });

  closeMilModal('spy-modal');
  addHistory(`🕵️ 向${nation.name}派遣细作，执行「${cfg.label}」任务。`, 'neutral');
  showResult({
    icon:'🕵️', title:'细作已派遣',
    desc:`细作已秘密出发，前往${nation.name}执行「${cfg.label}」任务。${cfg.turns}年后将有消息传回，请耐心等待。`,
    effects:{}, type:'neutral'
  }, ()=>showIdleState());
}

// 年度细作任务结算
function _resolveSpyMissions(){
  if(!G.spyMissions || G.spyMissions.length===0) return;
  const toRemove = [];
  G.spyMissions.forEach(mission=>{
    if(mission.status !== 'active') return;
    mission.turnsLeft--;
    if(mission.turnsLeft > 0) return;

    const cfg = SPY_MISSION_TYPES.find(m=>m.id===mission.missionId);
    const nation = NATIONS.find(n=>n.id===mission.targetId);
    if(!cfg || !nation){ toRemove.push(mission); return; }

    // 判断是否被发现
    const caught = Math.random() < mission.risk;
    if(caught){
      // 被发现：外交惩罚
      const penalty = { diplomacy:-8, prestige:-5 };
      applyEffects(penalty);
      nation.relation = Math.max(0, nation.relation - 15);
      addHistory(`⚠️ 派往${nation.name}的细作被发现！外交关系严重受损。`, 'bad');
      showToast(`🚨 细作在${nation.name}被捕！外交危机！`, 'warn');
      // 加入事件队列
      G.yearEvents.push({
        id: `spy_caught_${G.turn}`,
        tag: 'diplomacy', tagText: '外交危机',
        title: `细作在${nation.name}被捕`,
        scene: `${nation.emoji}${nation.name}国王震怒，将我方细作公开处决，并遣使来质问。此事已传遍天下，吴越颜面大损。`,
        desc: '',
        choices: [
          { label:'【道歉赔偿】', text:'承认错误，赔偿损失，修复关系', effect:{diplomacy:+5, treasury:-15},
            result:{icon:'🤝',title:'道歉赔偿',desc:`吴越主动道歉并赔偿，${nation.name}勉强接受，关系有所缓和。`,type:'neutral'},
            onConfirm:()=>{ nation.relation=Math.min(100,nation.relation+10); }
          },
          { label:'【矢口否认】', text:'否认派遣细作，强硬回应', effect:{diplomacy:-5, prestige:+3},
            result:{icon:'😤',title:'强硬否认',desc:`吴越否认一切，${nation.name}虽愤怒但无可奈何，双方关系持续紧张。`,type:'bad'}
          },
        ],
      });
    } else {
      // 成功
      const revealed = cfg.reveal(nation);
      if(Object.keys(revealed).length > 0){
        G.intelRevealed[nation.id] = { ...(G.intelRevealed[nation.id]||{}), ...revealed };
      }
      if(cfg.onSuccess) cfg.onSuccess(nation);
      const successMsg = cfg.successText(nation, revealed);
      addHistory(`✅ 细作任务成功：${successMsg}`, 'good');
      showToast(`🕵️ 细作任务成功！${cfg.label}完成`, 'info');
      // 更新情报面板
      const intelText = `【${nation.name}情报】${successMsg}`;
      G.intel.unshift({ tag:'intel', tagText:'情报', text:intelText });
      if(G.intel.length>8) G.intel.pop();
      renderIntel();
    }
    mission.status = 'done';
    toRemove.push(mission);
  });
  G.spyMissions = G.spyMissions.filter(m=>!toRemove.includes(m));
}

// ===================================================
//  新E项：王位继承系统
// ===================================================

const HEIR_NAMES_GIVEN = ['元','宗','德','仁','义','文','武','明','贤','达','通','博','远','深','厚','正','清','廉','直','刚'];
const HEIR_TRAITS = ['聪慧','仁厚','勇武','机敏','稳重','博学','刚毅','温和','果断','谨慎'];

// 初始化子嗣（游戏开始时调用）
function _initHeirs(){
  G.heirs = [];
  G.crownPrinceId = null;
  G.successionCrisis = false;
  // 钱弘俶28岁，初始有1-2个幼子
  const initCount = 1 + Math.floor(Math.random()*2);
  for(let i=0;i<initCount;i++){
    const heir = _generateHeir(Math.floor(Math.random()*5)+1);
    G.heirs.push(heir);
  }
  if(G.heirs.length > 0){
    G.crownPrinceId = G.heirs[0].id;
    G.heirs[0].isCrownPrince = true;
  }
}

function _generateHeir(age){
  const given = HEIR_NAMES_GIVEN[Math.floor(Math.random()*HEIR_NAMES_GIVEN.length)];
  const trait = HEIR_TRAITS[Math.floor(Math.random()*HEIR_TRAITS.length)];
  return {
    id: `heir_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
    name: `钱${given}`,
    age,
    ability: 40 + Math.floor(Math.random()*40),
    loyalty: 80 + Math.floor(Math.random()*20),
    trait,
    isCrownPrince: false,
    education: 0,  // 培养投入（0-100）
    bio: `钱弘俶之子，年${age}岁，性格${trait}。`,
  };
}

// 子嗣年度成长
function _doHeirGrowth(){
  if(!G.heirs) G.heirs = [];

  // 所有子嗣年龄+1
  G.heirs.forEach(h=>{
    h.age++;
    // 能力随年龄和培养度缓慢成长
    const growthChance = 0.3 + h.education/200;
    if(Math.random() < growthChance){
      h.ability = Math.min(95, h.ability + 1 + Math.floor(h.education/30));
    }
  });

  // 国王年龄（G.turn + 28）
  const kingAge = 28 + G.turn;

  // 每5年有30%概率新增子嗣（国王<50岁时）
  if(kingAge < 50 && G.turn % 5 === 0 && Math.random() < 0.3){
    const newHeir = _generateHeir(0);
    G.heirs.push(newHeir);
    addHistory(`🎉 王室喜讯：${newHeir.name}降生，钱弘俶又添一子！`, 'good');
    applyEffects({ stability:+2, people:+1 });
  }

  // 检查储位之争
  if(G.heirs.length === 0){
    // 无子嗣：触发储位危机
    if(!G.successionCrisis){
      G.successionCrisis = true;
      applyEffects({ stability:-8, people:-5 });
      addHistory('⚠️ 大王膝下无子，朝野议论纷纷，储位之争隐患渐显！', 'bad');
      G.yearEvents.push({
        id: `succession_crisis_${G.turn}`,
        tag: 'crisis', tagText: '储位危机',
        title: '储位悬空，朝野不安',
        scene: '大王膝下尚无子嗣，朝中重臣忧心忡忡，各方势力蠢蠢欲动，储位之争的阴云笼罩朝堂。',
        desc: '',
        choices: [
          { label:'【广纳后宫】', text:'广纳妃嫔，以求早日诞下子嗣', effect:{people:-3, stability:+2},
            result:{icon:'🏯',title:'广纳后宫',desc:'大王广纳后宫，朝野期待王室早日诞下子嗣。',type:'neutral'}
          },
          { label:'【过继宗室】', text:'从钱氏宗室中选一子过继，立为储君', effect:{stability:+5, prestige:+3},
            result:{icon:'👑',title:'过继储君',desc:'大王从宗室中选定继承人，储位之争暂时平息。',type:'good'},
            onConfirm:()=>{
              const adopted = _generateHeir(8 + Math.floor(Math.random()*5));
              adopted.name = '钱' + HEIR_NAMES_GIVEN[Math.floor(Math.random()*HEIR_NAMES_GIVEN.length)];
              adopted.bio = '钱氏宗室子弟，过继为王储。';
              G.heirs.push(adopted);
              G.crownPrinceId = adopted.id;
              adopted.isCrownPrince = true;
              G.successionCrisis = false;
              addHistory(`👑 大王过继${adopted.name}为储君，储位之争平息。`, 'good');
            }
          },
        ],
      });
    }
  } else {
    G.successionCrisis = false;
    // 确保太子设置正确
    if(!G.crownPrinceId || !G.heirs.find(h=>h.id===G.crownPrinceId)){
      // 选年龄最大且成年的子嗣为太子
      const adult = G.heirs.filter(h=>h.age>=10).sort((a,b)=>b.age-a.age)[0];
      if(adult){
        G.heirs.forEach(h=>h.isCrownPrince=false);
        adult.isCrownPrince = true;
        G.crownPrinceId = adult.id;
      }
    }
  }
}

// 子嗣管理弹窗
function openHeirModal(){
  if(!G.heirs || G.heirs.length===0){
    showToast('大王目前尚无子嗣', 'info');
    return;
  }

  const heirCards = G.heirs.map(h=>{
    const abilityColor = h.ability>=70?'#2ecc71':h.ability>=50?'#f39c12':'#e74c3c';
    const crownTag = h.isCrownPrince ? '<span style="color:#c9a84c;font-weight:700">👑 太子</span>' : '';
    const eduBar = `<div class="syd-bar-wrap" style="width:80px"><div class="syd-bar" style="width:${h.education}%;background:#6b3fa0"></div><span class="syd-bar-val">${h.education}</span></div>`;
    return `<div style="background:rgba(0,0,0,0.2);border-radius:6px;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-weight:600">${h.name} ${crownTag}</span>
        <span style="font-size:11px;color:var(--text-muted)">${h.age}岁 · ${h.trait}</span>
      </div>
      <div style="display:flex;gap:12px;font-size:11px;margin-bottom:6px">
        <span>能力：<b style="color:${abilityColor}">${h.ability}</b></span>
        <span>忠诚：<b>${h.loyalty}</b></span>
        <span>培养度：${eduBar}</span>
      </div>
      <div style="display:flex;gap:6px">
        ${!h.isCrownPrince ? `<button class="mil-alloc-btn" onclick="setCrownPrince('${h.id}')">立为太子</button>` : ''}
        <button class="mil-alloc-btn" onclick="educateHeir('${h.id}')">培养（10万贯）</button>
      </div>
    </div>`;
  }).join('');

  const crisisHtml = G.successionCrisis
    ? `<div style="background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.4);border-radius:4px;padding:8px;margin-bottom:10px;font-size:11px;color:#e74c3c">⚠️ 储位危机：大王尚无成年子嗣，朝野不安！</div>`
    : '';

  const html = `
    <div class="mil-modal-overlay" id="heir-modal" onclick="if(event.target===this)closeMilModal('heir-modal')">
      <div class="mil-modal-box">
        <div class="mil-modal-header">
          <span class="mil-modal-icon">👑</span>
          <div>
            <div class="mil-modal-title">王室子嗣</div>
            <div class="mil-modal-sub">管理子嗣培养与太子册立</div>
          </div>
          <button class="mil-modal-close" onclick="closeMilModal('heir-modal')">✕</button>
        </div>
        <div class="mil-modal-body">
          ${crisisHtml}
          ${heirCards}
        </div>
        <div class="mil-modal-footer">
          <button class="mil-btn-cancel" onclick="closeMilModal('heir-modal')">关闭</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function setCrownPrince(heirId){
  const heir = G.heirs.find(h=>h.id===heirId);
  if(!heir) return;
  G.heirs.forEach(h=>h.isCrownPrince=false);
  heir.isCrownPrince = true;
  G.crownPrinceId = heirId;
  closeMilModal('heir-modal');
  applyEffects({ stability:+3, prestige:+2 });
  addHistory(`👑 大王册立${heir.name}为太子，储位已定，朝野安心。`, 'good');
  showToast(`👑 ${heir.name}已被册立为太子`, 'info');
  openHeirModal();
}

function educateHeir(heirId){
  const heir = G.heirs.find(h=>h.id===heirId);
  if(!heir) return;
  const cost = 10;
  if(G.budget - G.budgetUsed < cost){ showToast('预算不足', 'warn'); return; }
  spendBudget(cost);
  heir.education = Math.min(100, heir.education + 15);
  heir.ability   = Math.min(95, heir.ability + 2);
  closeMilModal('heir-modal');
  addHistory(`📚 大王投入${cost}万贯培养${heir.name}，其学识与能力有所提升。`, 'good');
  showToast(`📚 ${heir.name}培养度+15，能力+2`, 'info');
  openHeirModal();
}

// ===================================================
//  初始化（script在body末尾，DOM已就绪，直接执行）
// ===================================================
(function init(){
  const ss = document.getElementById('start-screen');
  const gs = document.getElementById('game-screen');
  if(ss) ss.style.display='flex';
  if(gs) gs.style.display='none';

  // 检测是否有存档，动态显示继续游戏 / 读取存档按钮
  const hasAuto = hasAutoSave();
  const hasAny  = hasAuto || SAVE_SLOTS.some(s => !!localStorage.getItem(SAVE_PREFIX + s));

  const btnContinue = document.getElementById('btn-continue');
  const btnLoad     = document.getElementById('btn-load-save');
  if(btnContinue) btnContinue.style.display = hasAuto ? 'block' : 'none';
  if(btnLoad)     btnLoad.style.display     = hasAny  ? 'block' : 'none';
})();

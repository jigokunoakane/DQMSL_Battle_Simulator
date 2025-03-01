//初期処理とglobal変数群
let isDeveloperMode = false;
const allParties = Array(10)
  .fill(null)
  .map(() => Array(5).fill({}));
const parties = [];

let selectingPartyNum = 0;
let playerASelectedPartyNumber = 0;
let playerBSelectedPartyNumber = 5;
let selectingParty = allParties[0];
let currentPlayer = "A";
//モンスター装備変更用
let selectingMonsterNum = 0;
let selectingGearNum = 0;
let currentTab = 0;

//コマンド選択
let currentMonsterIndex = 0;
let currentTeamIndex = 0;

// プリセットコマンドを記録
const presetCommands = [];

//戦闘中に使用
let fieldState = {};
let turnOrder = [];
// 死亡時発動能力のキュー
let deathActionQueue = [];
// processDeathActionの実行中かどうかを示すフラグ
let isProcessingDeathAction = false;

const imageCache = {};
// 各モンスターのバフ表示を管理するオブジェクト
let buffDisplayTimers = {};
//あとはmonster dataとskill dataと装備data および各種特性関数

// アクティブなsleep関数のresolve関数を格納する配列
let sleepResolvers = [];
let isSkipMode = false;
// sleep関数にかける倍率
let waitMultiplier = 1;

function switchParty() {
  // selectingPartyNumを選択値に更新して、パテ切り替え
  //switchPartyに変更
  selectingPartyNum = Number(document.getElementById("switchParty").value);
  selectingParty = allParties[selectingPartyNum];

  //頭モンスターを選択状態に
  //これで、icon2種、ステ、種増分、種選択、特技の表示更新も兼ねる
  switchTab(0);

  // selectingPartyの中身からアイコンを展開
  for (let i = 0; i <= 4; i++) {
    updatePartyIcon(i);
  }
}

// selectingPartyのうちn番目のpartyIconを更新する関数
function updatePartyIcon(number) {
  const monster = selectingParty[number];
  const iconSrc = Object.keys(monster).length !== 0 ? "images/icons/" + monster.id + ".jpeg" : "images/icons/unselected.jpeg";
  const gearSrc = Object.keys(monster).length !== 0 && monster.gear ? "images/gear/" + monster.gear?.id + ".jpeg" : "images/gear/unGeared.jpeg";
  document.getElementById(`partyIcon${number}`).src = iconSrc;
  document.getElementById(`partyGear${number}`).src = gearSrc;
}

//どちらのプレイヤーがパテ選択中かの関数定義
function decideParty() {
  const switchPartyElement = document.getElementById("switchParty");
  if (currentPlayer === "A") {
    //現在の仮partyを対戦用partiesにcopy 空monsterは削除
    parties[0] = structuredClone(selectingParty).filter((element) => Object.keys(element).length !== 0);
    // 空の場合は停止
    if (parties[0].length === 0) return;
    // playerBの選択に移行
    currentPlayer = "B";
    document.getElementById("playerAorB").textContent = "player B";
    // 保存
    playerASelectedPartyNumber = selectingPartyNum;
    // selectのoptionを変更
    for (let i = 6; i <= 10; i++) {
      switchPartyElement.innerHTML += `<option value="${i - 1}">パーティ${i - 5}</option>`;
    }
    switchPartyElement.querySelectorAll('option[value="0"], option[value="1"], option[value="2"], option[value="3"], option[value="4"]').forEach((option) => option.remove());
    // switchPartyElementを5にして敵を表示状態にした上で、switchPartyで展開
    document.getElementById("switchParty").value = playerBSelectedPartyNumber; //保存していた番号に切替え
    switchParty();
  } else {
    // 対戦用partiesにcopy 空monsterは削除
    parties[1] = structuredClone(selectingParty).filter((element) => Object.keys(element).length !== 0);
    // 空の場合は停止
    if (parties[1].length === 0) return;
    // playerAの選択に戻す
    currentPlayer = "A";
    document.getElementById("playerAorB").textContent = "player A";
    // 保存
    playerBSelectedPartyNumber = selectingPartyNum;
    // selectのoptionを変更
    for (let i = 1; i <= 5; i++) {
      switchPartyElement.innerHTML += `<option value="${i - 1}">パーティ${i}</option>`;
    }
    switchPartyElement.querySelectorAll('option[value="5"], option[value="6"], option[value="7"], option[value="8"], option[value="9"]').forEach((option) => option.remove());
    // switchPartyElementを0にして味方を表示状態にした上で、switchPartyで展開
    document.getElementById("switchParty").value = playerASelectedPartyNumber; //保存していた番号に切替え
    switchParty();

    //displayで全体切り替え、battle画面へ
    document.getElementById("pageHeader").style.display = "none";
    document.getElementById("adjustPartyPage").style.display = "none";
    document.getElementById("battlePage").style.display = "block";
    // skip状態を解除し、skip解除表示を戻す
    setSkipMode(false);
    preloadImages();
    prepareBattle();
  }
}

//パテ設定画面の確定で起動
async function prepareBattle() {
  // 初期化
  fieldState = { turnNum: 0, deathCount: { 0: 0, 1: 0 }, completeDeathCount: { 0: 0, 1: 0 } };
  currentTeamIndex = 0;
  currentMonsterIndex = 0;

  // 初期生成
  for (let i = 0; i < parties.length; i++) {
    const party = parties[i];
    // 要素ID用のprefix
    const prefix = i === 0 ? "ally" : "enemy";
    const reversedPrefix = i === 1 ? "ally" : "enemy";

    // リーダースキルの取得
    const firstMonster = party[0];
    const leaderSkill = firstMonster.ls;
    const lsTarget = firstMonster.lsTarget;
    const excludeLsTarget = firstMonster.excludeLsTarget;

    for (let j = 0; j < party.length; j++) {
      const monster = party[j];

      // 敵味方識別子を追加
      monster.teamID = i;
      monster.enemyTeamID = i === 0 ? 1 : 0;

      // 各要素のIDを作成
      monster.index = j;
      monster.monsterId = `parties[${i}][${j}]`;
      monster.iconElementId = `${prefix}BattleIcon${j}`;
      monster.reversedIconElementId = `${reversedPrefix}BattleIcon${j}`;
      monster.iconSrc = "images/icons/" + monster.id + ".jpeg";

      // skill生成
      monster.skill = [...monster.defaultSkill];
      monster.availableSkillsOnAIthisTurn = [...monster.skill];

      // ステータス処理
      monster.defaultStatus = {};
      for (const key in monster.displayStatus) {
        // リーダースキル適用
        let lsMultiplier = 1;
        if (
          leaderSkill[key] &&
          ((lsTarget === "all" && (!excludeLsTarget || !monster.race.includes(excludeLsTarget))) || monster.race.includes(lsTarget) || (lsTarget === "break" && isBreakMonster(monster)))
        ) {
          lsMultiplier = leaderSkill[key];
        }
        // ルビスを起点に
        if (firstMonster.name === "大地の精霊ルビス" && (key === "HP" || key === "spd")) {
          const multiplier = key === "HP" ? 0.1 : 0.03;
          lsMultiplier = countRubisTarget(party) * multiplier + 1;
        }
        // 装備効果
        if (monster.gear) {
          // 素早さ錬金
          if (key === "spd") {
            const gearName = monster.gear.name;
            if (monster.gear.alchemy && ["魔獣", "ドラゴン", "ゾンビ", "物質"].some((r) => monster.race.includes(r))) {
              lsMultiplier += 0.05;
            }
            if (isBreakMonster(monster) && (gearName === "凶帝王のつるぎ" || gearName === "ハザードネイル")) {
              lsMultiplier += 0.08;
            }
            if (monster.race.includes("悪魔") && gearName === "うみなりの杖悪魔錬金") {
              lsMultiplier += 0.05;
            }
            if (monster.race.includes("悪魔") && gearName === "盗賊ハート・闇") {
              lsMultiplier += 0.05;
            }
            if (monster.race.includes("魔獣") && gearName === "盗賊ハート・獣") {
              lsMultiplier += 0.05;
            }
            if (gearName === "エビルクロー") {
              lsMultiplier += 0.05;
            }
          }
          // 装備のstatusMultiplierを適用
          if (monster.gear.statusMultiplier && monster.gear.statusMultiplier[key]) {
            lsMultiplier += monster.gear.statusMultiplier[key];
          }
          // ゾーマローブ
          if (key === "HP" && monster.race.includes("???") && monster.gear.name === "ゾーマのローブ") {
            lsMultiplier += 0.1;
          }
        }
        // HPまたはMPの場合、乗数を0.04加算
        if (key === "HP" || key === "MP") {
          lsMultiplier += 0.04;
        }
        // パラディンハート
        let HPIncrement = 0;
        if (monster.race.includes("スライム") && monster.gear?.name === "パラディンハート・蒼" && key === "HP") {
          HPIncrement = 30;
        }
        monster.defaultStatus[key] = Math.ceil(monster.displayStatus[key] * lsMultiplier) + HPIncrement;
      }
      monster.currentStatus = { ...monster.defaultStatus };

      // 初期化
      monster.commandInput = "";
      monster.commandTargetInput = null;
      monster.currentAiType = monster.defaultAiType || "ガンガンいこうぜ";
      monster.buffs = {};
      monster.flags = { unavailableSkills: [], executedAbilities: [], thisTurn: {} };
      monster.attribute.additionalPermanentBuffs = {};
      monster.attribute.additionalEvenTurnBuffs = {};
      // monsterAbilitiesの内容をmonsterDataにコピー
      monster.abilities = getMonsterAbilities(monster.id);
      //supportAbilitiesまたはattackAbilitiesオブジェクトを生成、additionalPermanentとnextTurn配列を初期生成(push時に毎回additionalの存在確認不要にする)
      monster.abilities.supportAbilities = monster.abilities.supportAbilities || {};
      monster.abilities.supportAbilities.additionalPermanentAbilities = [];
      monster.abilities.supportAbilities.nextTurnAbilities = [];
      monster.abilities.attackAbilities = monster.abilities.attackAbilities || {};
      monster.abilities.attackAbilities.additionalPermanentAbilities = [];
      monster.abilities.attackAbilities.nextTurnAbilities = [];
      // 死亡時abilityを生成
      monster.abilities.deathAbilities = monster.abilities.deathAbilities || [];
      monster.abilities.additionalDeathAbilities = [];
      // 行動後abilityを生成
      monster.abilities.afterActionAbilities = monster.abilities.afterActionAbilities || [];
      monster.abilities.additionalAfterActionAbilities = [];
      // 反撃abilityを生成
      monster.abilities.counterAbilities = monster.abilities.counterAbilities || [];
      monster.abilities.additionalCounterAbilities = [];
    }
  }

  //数が不均衡な場合に備えて存在しないbarを削除しつつ全体のbarを更新
  await setMonsterBarDisplay();
  //戦闘画面の10のimgのsrcを設定
  //partyの中身のidとgearIdから、適切な画像を設定
  prepareBattlePageIcons();
  //最初に全てのpopupを閉じる
  closeAllPopupContents();
  //コマンドボタン無効化 特性演出終了後に有効化
  disableCommandBtn(true);
  removeAllStickOut();
  //bgmを再生
  playBGM();
  //field管理用変数の導入はglobalで
  // プリセット存在時のみプリセットを用いた戦闘開始を可能に
  if (presetCommands.length > 0) {
    document.getElementById("startBattleWithPresetCommandBtn").style.display = "block";
  } else {
    document.getElementById("startBattleWithPresetCommandBtn").style.display = "none";
  }
  await startTurn();
}
//finish prepareBattle 開始時処理終了

//死亡処理で起動、死亡時や亡者化のicon変化処理、prepareBattlePageIconsでも起動して敵skill選択時の反転にそれを反映する
//状態を変化させてから配列を渡せば、状態に合わせて自動的に更新
function updateBattleIcons(monster, reverseDisplay = false) {
  const upperTeamId = reverseDisplay ? 0 : 1;
  const targetElementId = reverseDisplay ? monster.reversedIconElementId : monster.iconElementId;
  const targetElement = document.getElementById(targetElementId);
  targetElement.src = monster.iconSrc;
  // 対面monsterが存在しないとき、対面のアイコンを非表示に
  if (!parties[monster.enemyTeamID][monster.index]) {
    const enemyTargetElementId = reverseDisplay ? monster.iconElementId : monster.reversedIconElementId;
    deleteIconAndBuffDisplay(enemyTargetElementId);
  }

  targetElement.style.visibility = "visible";
  //上側表示かつ死亡は非表示、下かつ死亡は暗転、亡者は全て中間
  if (monster.teamID === upperTeamId && monster.flags?.isDead) {
    targetElement.style.visibility = "hidden";
  } else {
    if (monster.flags?.isZombie) {
      targetElement.style.filter = "brightness(80%)"; //todo:不要か？
    } else if (!monster.flags?.isZombie && monster.teamID !== upperTeamId && monster.flags?.isDead) {
      targetElement.style.filter = "brightness(25%)";
    } else {
      targetElement.style.filter = "brightness(100%)";
    }
  }
}

function deleteIconAndBuffDisplay(enemyTargetElementId) {
  //buffContainerを削除
  document
    .getElementById(enemyTargetElementId)
    .parentNode.querySelectorAll(".buffContainer")
    .forEach((buffContainer) => {
      buffContainer.remove();
    });
  document.getElementById(enemyTargetElementId).src = "";
  document.getElementById(enemyTargetElementId).style.visibility = "hidden";
}

//敵コマンド入力時に引数にtrueを渡して一時的に反転 反転戻す時と初期処理では引数なしで通常表示
function prepareBattlePageIcons(reverseDisplay = false) {
  // 初期化で全て非表示にする 対面は削除できるが、両方ともに2体の場合残り3体の表示が残るのを防止
  const iconElements = [
    "allyBattleIcon0",
    "allyBattleIcon1",
    "allyBattleIcon2",
    "allyBattleIcon3",
    "allyBattleIcon4",
    "enemyBattleIcon0",
    "enemyBattleIcon1",
    "enemyBattleIcon2",
    "enemyBattleIcon3",
    "enemyBattleIcon4",
  ];
  for (const element of iconElements) {
    deleteIconAndBuffDisplay(element);
  }
  for (const party of parties) {
    for (const monster of party) {
      updateBattleIcons(monster, reverseDisplay);
    }
  }
}

//HP,MPのテキスト表示とバーを更新する これは戦闘開始時と毎ダメージ処理後applyDamage内で起動
function updateMonsterBar(monster, displayRedBar = false, isReversed = false) {
  // IDのプレフィックスを切り替える
  let prefix = monster.teamID === 0 ? "ally" : "enemy";
  if (isReversed) {
    prefix = prefix === "ally" ? "enemy" : "ally"; // 逆転フラグがtrueならプレフィックスを反転
  }

  // IDを生成
  const hpBarElementId = `${prefix}HpBar${monster.index}`;
  const mpBarElementId = `${prefix}MpBar${monster.index}`;
  const hpBarInnerId = `${prefix}HpBarInner${monster.index}`;
  const mpBarInnerId = `${prefix}MpBarInner${monster.index}`;
  const hpBarTextElementId = `${prefix}HpBarText${monster.index}`;
  const mpBarTextElementId = `${prefix}MpBarText${monster.index}`;

  // 表示対象の要素を取得
  const hpBarElement = document.getElementById(hpBarElementId);
  const mpBarElement = document.getElementById(mpBarElementId);
  const hpBarInner = document.getElementById(hpBarInnerId);
  const mpBarInner = document.getElementById(mpBarInnerId);
  const hpBarTextElement = document.getElementById(hpBarTextElementId);
  const mpBarTextElement = document.getElementById(mpBarTextElementId);

  // prefixが敵かつ死亡(亡者化)している場合は非表示化
  if (prefix === "enemy" && (monster.flags.isDead || monster.flags.isZombie)) {
    hpBarElement.style.visibility = "hidden";
  } else {
    // prefixが味方の場合、または敵かつ生存しているときに、HP表示化処理と更新処理
    hpBarElement.style.visibility = "visible"; //表示化

    // HPバーの更新
    const currentHpPercentage = parseFloat(hpBarInner.style.width); // 現在の幅を取得
    const hpPercentage = (monster.currentStatus.HP / monster.defaultStatus.HP) * 100;
    hpBarInner.style.width = `${hpPercentage}%`; // 即座に幅を更新

    // ダメージ表示
    const damageDisplayId = `${prefix}DamageDisplay${monster.index}`;
    const damageDisplay = document.getElementById(damageDisplayId);

    if (displayRedBar && damageDisplay) {
      // ダメージがある場合
      damageDisplay.style.width = `${currentHpPercentage}%`; // 赤いバーを現在のHPの長さに設定
      damageDisplay.style.transition = "none"; // 一旦トランジションを無効化
      damageDisplay.offsetWidth; // ブラウザにスタイルの適用を強制
      damageDisplay.style.transition = "width 0.2s ease-in-out"; // トランジションを有効化
      damageDisplay.style.width = `${hpPercentage}%`; // 0.2秒かけて新しいHPの長さまで縮める

      // 0.2秒後に赤いバーを非表示にする
      setTimeout(() => {
        damageDisplay.style.width = "0%";
      }, 200);
    } else {
      // ダメージがない場合
      damageDisplay.style.width = "0%"; // 赤いバーを非表示にする
      damageDisplay.style.transition = "none"; // トランジションを無効化
    }

    // テキストの更新 敵monsterはtext存在しないのでnullならば操作しない
    if (hpBarTextElement) {
      hpBarTextElement.textContent = monster.currentStatus.HP;
    }
  }

  // prefixが味方の場合のみ、MP表示化処理と更新処理
  if (prefix === "ally") {
    mpBarElement.style.visibility = "visible"; //表示化
    const mpPercentage = (monster.currentStatus.MP / monster.defaultStatus.MP) * 100;
    mpBarInner.style.width = `${mpPercentage}%`;
    mpBarTextElement.textContent = monster.currentStatus.MP;
  }
}

//敵skill選択時や戻す時に起動
async function setMonsterBarDisplay(isReverse = false) {
  document.querySelectorAll(".bar").forEach((bar) => {
    bar.style.visibility = "hidden";
  });
  for (const party of parties) {
    for (const monster of party) {
      updateMonsterBar(monster, false, isReverse);
      await updateMonsterBuffsDisplay(monster, isReverse);
    }
  }
}

//////////////////////////////////////////////////////////////コマンド選択フロー
//////////////通常攻撃
document.getElementById("commandNormalAttackBtn").addEventListener("click", function () {
  document.getElementById("startBattleWithPresetCommandBtn").style.display = "none";
  disableCommandBtn(true);
  const skillUser = parties[currentTeamIndex][currentMonsterIndex];
  const normalAttackName = getNormalAttackName(skillUser);
  skillUser.commandInput = normalAttackName;
  document.getElementById("commandPopupWindowText").textContent = "たたかう敵モンスターをタッチしてください。";
  document.getElementById("commandPopupWindowText").style.visibility = "visible";
  selectSkillTargetToggler(currentTeamIndex === 0 ? 1 : 0, "single", "enemy", findSkillByName("通常攻撃")); //味方画像
  document.getElementById("selectSkillTargetContainer").style.visibility = "visible";
  document.getElementById("commandPopupWindow").style.visibility = "visible";
  displaySkillResistances(skillUser, findSkillByName(normalAttackName));
});

/////////////ぼうぎょ
document.getElementById("commandGuardBtn").addEventListener("click", function () {
  document.getElementById("startBattleWithPresetCommandBtn").style.display = "none";
  parties[currentTeamIndex][currentMonsterIndex].commandInput = "ぼうぎょ";
  finishSelectingEachMonstersCommand();
});

////////////AI
document.getElementById("commandAIBtn").addEventListener("click", function () {
  document.getElementById("startBattleWithPresetCommandBtn").style.display = "none";
  // 進捗状況を管理する変数tempSelectingMonsterIndexを現在値にセットしてstart
  let tempSelectingMonsterIndex = currentMonsterIndex;

  // index最大4まで連続処理
  while (tempSelectingMonsterIndex < parties[currentTeamIndex].length) {
    const skillUser = parties[currentTeamIndex][tempSelectingMonsterIndex];
    if (!isDead(skillUser) && !skillUser.flags.isZombie && !hasAbnormality(skillUser)) {
      // コマンド可能な場合、AI指定して、現在選択中のindexを更新
      skillUser.commandInput = "normalAICommand";
      currentMonsterIndex = tempSelectingMonsterIndex;
    }
    tempSelectingMonsterIndex++;
  }
  //tempSelectingMonsterIndexが5になって停止

  // すべてのモンスターについて処理終了時
  adjustMonsterIconStickOut();
  askFinishCommand();
});

// startSelectingCommand() とくぎ選択開始
document.getElementById("commandSelectSkillBtn").addEventListener("click", function () {
  document.getElementById("startBattleWithPresetCommandBtn").style.display = "none";
  disableCommandBtn(true);
  //party内該当monsterのskillのn番目要素をそのまま表示
  const skillUser = parties[currentTeamIndex][currentMonsterIndex];
  for (let i = 0; i < 4; i++) {
    const selectSkillBtn = document.getElementById(`selectSkillBtn${i}`);
    const skillName = skillUser.skill[i];
    const skillInfo = findSkillByName(skillName);
    const MPcost = calculateMPcost(skillUser, skillInfo);
    // 表示更新
    selectSkillBtn.textContent = skillInfo.displayName || skillName;
    if (
      skillUser.flags.unavailableSkills.includes(skillName) ||
      !hasEnoughMpForSkill(skillUser, skillInfo) ||
      (skillInfo.unavailableIf && skillInfo.unavailableIf(skillUser)) ||
      skillUser.buffs[skillInfo.type + "Seal"]
    ) {
      selectSkillBtn.disabled = true;
      selectSkillBtn.style.opacity = "0.4";
    } else {
      selectSkillBtn.disabled = false;
      selectSkillBtn.style.opacity = "";
    }
  }
  document.getElementById("selectSkillBtnContainer").style.visibility = "visible";
  document.getElementById("commandPopupWindowText").textContent = skillUser.name;
  document.getElementById("commandPopupWindowText").style.visibility = "visible";
  document.getElementById("commandPopupWindow").style.visibility = "visible";
  //monster名表示に戻す
  //todo:inline?block?
  displayMessage("とくぎをえらんでください。");
});

function selectCommand(selectedSkillNum) {
  document.getElementById("selectSkillBtnContainer").style.visibility = "hidden";
  const skillUser = parties[currentTeamIndex][currentMonsterIndex];
  const selectedSkillName = skillUser.skill[selectedSkillNum];
  //commandInputに格納
  skillUser.commandInput = selectedSkillName;
  const selectedSkill = findSkillByName(selectedSkillName);
  //表示用
  const displaySkillName = selectedSkill.displayName || selectedSkillName;
  const selectedSkillTargetType = selectedSkill.targetType;
  const selectedSkillTargetTeam = selectedSkill.targetTeam;

  //nameからskill配列を検索、targetTypeとtargetTeamを引いてくる
  if (selectedSkillTargetType === "random" || selectedSkillTargetType === "single" || selectedSkillTargetType === "dead") {
    displaySkillDiscription(skillUser, selectedSkill, displaySkillName);
    //randomもしくはsingleのときはtextをmonster名から指示に変更、target選択画面を表示
    document.getElementById("commandPopupWindowText").textContent = "たたかう敵モンスターをタッチしてください。";
    if (selectedSkillTargetTeam === "ally") {
      document.getElementById("commandPopupWindowText").textContent = "モンスターをタッチしてください。";
    } else if (selectedSkillTargetType === "dead") {
      document.getElementById("commandPopupWindowText").textContent = "回復するモンスターをタッチしてください。";
    }

    //味方選択中かつskillのtargetTeamがenemyのとき、または敵選択中かつskillのtargetTeamがallyのとき、敵画像を代入
    //逆に味方選択中かつtargetTeamがallyのとき、または敵選択中かつtargetTeamがenemyのとき、味方画像を代入
    if ((currentTeamIndex === 0 && selectedSkillTargetTeam === "enemy") || (currentTeamIndex === 1 && selectedSkillTargetTeam === "ally")) {
      selectSkillTargetToggler(1, selectedSkillTargetType, selectedSkillTargetTeam, selectedSkill); //敵画像
    } else {
      selectSkillTargetToggler(0, selectedSkillTargetType, selectedSkillTargetTeam, selectedSkill); //味方画像
    }
    document.getElementById("selectSkillTargetContainer").style.visibility = "visible";
  } else if (selectedSkillTargetType === "all" || selectedSkillTargetType === "field") {
    displaySkillDiscription(skillUser, selectedSkill, displaySkillName);
    //targetがallのとき、all(yes,no)画面を起動
    document.getElementById("commandPopupWindowText").style.visibility = "hidden";
    //allならmonster名は隠すのみ
    document.getElementById("selectSkillTargetAllText").textContent = displaySkillName + "+3を使用しますか？";
    document.getElementById("selectSkillTargetAll").style.visibility = "visible";
  } else {
    //targetがmeのとき、そのまま終了
    document.getElementById("commandPopupWindowText").style.visibility = "hidden";
    finishSelectingEachMonstersCommand();
  }
  displaySkillResistances(skillUser, selectedSkill);
}

function selectSkillTargetToggler(targetTeamNum, selectedSkillTargetType, selectedSkillTargetTeam, selectedSkill) {
  //target選択、敵画像か味方画像か 通常攻撃かsingle, randomで起動
  for (let i = 0; i < 5; i++) {
    const targetMonsterElement = document.getElementById(`selectSkillTarget${i}`);
    const targetMonsterWrapper = targetMonsterElement.parentNode; // wrapper要素を取得
    const targetMonster = parties[targetTeamNum][i];

    // モンスター情報が存在しない場合、枠を非表示にしてcontinue
    if (targetMonster) {
      targetMonsterElement.src = targetMonster.iconSrc;
      targetMonsterElement.style.display = "inline";
      targetMonsterWrapper.style.display = "flex";
    } else {
      targetMonsterElement.style.display = "none";
      targetMonsterWrapper.style.display = "none";
      continue; // 次のモンスターの処理へ
    }

    //モンスター情報が存在する場合、初期化で暗転&無効化解除
    toggleDarkenAndClick(targetMonsterElement, false);

    if (selectedSkillTargetType === "dead") {
      // 蘇生などdead対象のskillの場合、蘇生封じを持っていない死亡monsterのみ表示 対象外の生存モンスターまたは蘇生封じ持ちを非表示化
      if (!targetMonster.flags.isDead || targetMonster.buffs.reviveBlock) {
        targetMonsterElement.style.display = "none";
        targetMonsterWrapper.style.display = "none";
      }
    } else {
      // dead以外の通常スキルで、敵対象skillの場合、死亡している敵は非表示化
      if (targetMonster.flags.isDead) {
        if (selectedSkillTargetTeam === "enemy") {
          targetMonsterElement.style.display = "none";
          targetMonsterWrapper.style.display = "none";
        } else if (selectedSkillTargetTeam === "ally") {
          // 味方対象skillは死亡していても非表示ではなく暗転無効化(みがわり等)
          toggleDarkenAndClick(targetMonsterElement, true);
        }
      }
    }

    // スキル指定の除外対象
    if (selectedSkill.excludeTarget && selectedSkill.excludeTarget(targetMonster)) {
      toggleDarkenAndClick(targetMonsterElement, true);
    }
    //みがわり系の場合、自分自身と覆う中・覆われ中の対象を暗転&無効化
    const singleSubstituteSkills = ["みがわり", "かばう", "おおいかくす", "みがわり・マインドバリア"];
    if (singleSubstituteSkills.includes(selectedSkill.name) && (currentMonsterIndex === i || targetMonster.flags.isSubstituting || targetMonster.flags.hasSubstitute)) {
      toggleDarkenAndClick(targetMonsterElement, true);
    }
  }
}

//all-yesBtnの場合、そのmonsterのコマンド選択終了
document.getElementById("selectSkillTargetBtnYes").addEventListener("click", function () {
  clearAllSkillResistance();
  finishSelectingEachMonstersCommand();
});

//all-noBtn処理
document.getElementById("selectSkillTargetBtnNo").addEventListener("click", function () {
  clearAllSkillResistance();
  document.getElementById("selectSkillTargetAll").style.visibility = "hidden";
  document.getElementById("commandPopupWindow").style.visibility = "hidden";
  disableCommandBtn(false);
  //yes,no画面とpopup全体を閉じる、選択済のcommandInputとtarget:allは後で新規選択されたら上書き
  displayMessage(`${parties[currentTeamIndex][currentMonsterIndex].name}のこうどう`, "コマンド？");
});

//skillTarget選択画面
document.querySelectorAll(".selectSkillTarget").forEach((img) => {
  img.addEventListener("click", () => {
    clearAllSkillResistance();
    const imgId = img.getAttribute("id");
    parties[currentTeamIndex][currentMonsterIndex].commandTargetInput = parseInt(imgId.replace("selectSkillTarget", ""));
    document.getElementById("selectSkillTargetContainer").style.visibility = "hidden";
    document.getElementById("commandPopupWindowText").style.visibility = "hidden";
    //テキストとtarget選択iconを閉じる
    finishSelectingEachMonstersCommand();
  });
});

// allでyes選択時、skillTarget選択後、ぼうぎょ選択、target:me選択後に起動。次のmonsterのskill選択に移行する
// 行動不能なモンスターのcommandInputは設定済なので単純に増加
function finishSelectingEachMonstersCommand() {
  document.getElementById("selectSkillTargetAll").style.visibility = "hidden";

  // [0][4]の終了時、5が引数に渡されてreturn 100
  const nextMonsterIndex = findNextActionableMonsterIndex(currentMonsterIndex + 1);

  // すべてのモンスターの選択が終了した場合
  if (nextMonsterIndex === 100) {
    askFinishCommand();
  } else {
    // 行動可能なモンスターが見つかった場合
    currentMonsterIndex = nextMonsterIndex;
    adjustMonsterIconStickOut();
    displayMessage(`${parties[currentTeamIndex][currentMonsterIndex].name}のこうどう`, "コマンド？");
    document.getElementById("commandPopupWindow").style.visibility = "hidden";
    disableCommandBtn(false);
  }
}
function findNextActionableMonsterIndex(startIndex) {
  for (let i = startIndex; i < parties[currentTeamIndex].length; i++) {
    const monster = parties[currentTeamIndex][i];
    if (!isDead(monster) && !monster.flags.isZombie && !hasAbnormality(monster)) {
      return i;
    }
  }
  return 100;
}

// コマンド選択開始関数
function startSelectingCommandForFirstMonster(teamNum) {
  initializeMonsterCommands(teamNum);

  // parties[teamNum]の先頭から、行動可能なモンスターを探す
  currentTeamIndex = teamNum;
  const firstActionableMonsterIndex = findFirstActionableMonsterIndex(teamNum);

  // 前の戦闘で全員選択不能で非表示になっていた場合に備え、最初に解除
  document.getElementById("closeCommandPopupWindowBtn").style.display = "block";

  // 敵が全員行動不能な場合
  if (firstActionableMonsterIndex === 100) {
    if (teamNum === 1) {
      //敵コマンド選択でplayerを選んだ場合用
      document.getElementById("howToCommandEnemy").style.visibility = "hidden";
      //アイコン反転
      prepareBattlePageIcons(true);
      //barとバフ反転
      setMonsterBarDisplay(true);
    }
    // パーティーが全員行動不能の場合の処理
    removeAllStickOut(); //adjustではない
    askFinishCommand();
    disableCommandBtn(true);
    document.getElementById("askFinishCommandBtnNo").disabled = true;
    document.getElementById("closeCommandPopupWindowBtn").style.display = "none";
  } else {
    // 行動可能なモンスターが見つかった場合、コマンド選択画面を表示
    currentMonsterIndex = firstActionableMonsterIndex;
    adjustMonsterIconStickOut();
    displayMessage(`${parties[currentTeamIndex][currentMonsterIndex].name}のこうどう`, "コマンド？");
    // コマンドボタンを有効化
    disableCommandBtn(false);
    if (teamNum === 1) {
      //敵コマンド選択でplayerを選んだ場合用
      document.getElementById("howToCommandEnemy").style.visibility = "hidden";
      document.getElementById("commandPopupWindow").style.visibility = "hidden";
      //アイコン反転
      prepareBattlePageIcons(true);
      adjustMonsterIconStickOut();
      //barとバフ反転
      setMonsterBarDisplay(true);
    }
  }
}

function initializeMonsterCommands(teamNum) {
  for (const monster of parties[teamNum]) {
    monster.commandInput = "";
    monster.commandTargetInput = null;
    if (isDead(monster)) {
      monster.commandInput = "skipThisTurn";
    } else if (hasAbnormality(monster) || monster.flags.isZombie) {
      monster.commandInput = "normalAICommand";
    }
  }
}

function findFirstActionableMonsterIndex(teamNum) {
  for (let i = 0; i < parties[teamNum].length; i++) {
    const monster = parties[teamNum][i];
    if (!isDead(monster) && !monster.flags.isZombie && !hasAbnormality(monster)) {
      return i;
    }
  }
  return 100;
}

//allのyes btnと、skillTarget選択後に起動する場合、+=1された次のモンスターをstickOut
//backBtnとprepareBattleで起動する場合、-1された相手もしくは0の状態でstickOut
//一旦全削除用function、コマンド選択終了時にも起動
function removeAllStickOut() {
  const allMonsterIconsToStickOut = document.querySelectorAll(".battleIconWrapper");
  allMonsterIconsToStickOut.forEach((monsterIcon) => {
    monsterIcon.classList.remove("stickOut");
  });
}
//防御の引っ込みを消す ターン終了時に起動 死亡時は個別に削除
function removeAllRecede() {
  const allMonsterIconsToRecede = document.querySelectorAll(".battleIconWrapper");
  allMonsterIconsToRecede.forEach((monsterIcon) => {
    monsterIcon.classList.remove("recede");
  });
}
//現在選択中のmonster imgにclass:stickOutを付与
function adjustMonsterIconStickOut() {
  removeAllStickOut();
  const targetBattleIconToStickOut = document.getElementById(`allyBattleIcon${currentMonsterIndex}`);
  targetBattleIconToStickOut.parentNode.classList.add("stickOut");
}

document.getElementById("commandBackBtn").addEventListener("click", function () {
  document.getElementById("startBattleWithPresetCommandBtn").style.display = "none";
  // 現在選択中のモンスターより前に行動可能なモンスターがいるか確認
  let previousActionableMonsterIndex = currentMonsterIndex - 1;
  while (previousActionableMonsterIndex >= 0) {
    if (
      !isDead(parties[currentTeamIndex][previousActionableMonsterIndex]) &&
      !parties[currentTeamIndex][previousActionableMonsterIndex].flags.isZombie &&
      !hasAbnormality(parties[currentTeamIndex][previousActionableMonsterIndex])
    ) {
      // 行動可能なモンスターが見つかった場合、そのモンスターを選択
      currentMonsterIndex = previousActionableMonsterIndex;
      adjustMonsterIconStickOut();
      displayMessage(`${parties[currentTeamIndex][currentMonsterIndex].name}のこうどう`, "コマンド？");
      return;
    }
    previousActionableMonsterIndex--;
  }
});

// AI調整画面を開く
document.getElementById("commandAdjustAIBtn").addEventListener("click", function () {
  document.getElementById("startBattleWithPresetCommandBtn").style.display = "none";
  disableCommandBtn(true);
  document.getElementById("commandPopupWindowAdjustAiText").textContent = `現在のAI: ${parties[currentTeamIndex][currentMonsterIndex].currentAiType}`;
  document.getElementById("commandPopupWindowAdjustAi").style.visibility = "visible";
  document.getElementById("commandPopupWindow").style.visibility = "visible";
});
document.getElementById("ajustAiShowNoMercy").addEventListener("click", function () {
  parties[currentTeamIndex][currentMonsterIndex].currentAiType = "ガンガンいこうぜ";
  closeSelectCommandPopupWindowContents();
});
//document.getElementById("ajustAiNoSkillUse").addEventListener("click", function () {
//  parties[currentTeamIndex][currentMonsterIndex].currentAiType = "とくぎつかうな";
//  closeSelectCommandPopupWindowContents();
//});
document.getElementById("ajustAiFocusOnHealing").addEventListener("click", function () {
  parties[currentTeamIndex][currentMonsterIndex].currentAiType = "いのちだいじに";
  closeSelectCommandPopupWindowContents();
});

function closeAllPopupContents() {
  document.getElementById("selectSkillTargetContainer").style.visibility = "hidden";
  document.getElementById("selectSkillTargetAll").style.visibility = "hidden";
  document.getElementById("selectSkillBtnContainer").style.visibility = "hidden";
  document.getElementById("commandPopupWindow").style.visibility = "hidden";
  document.getElementById("commandPopupWindowText").style.visibility = "hidden";
  document.getElementById("commandPopupWindowAdjustAi").style.visibility = "hidden";
  document.getElementById("askFinishCommand").style.visibility = "hidden";
  document.getElementById("howToCommandEnemy").style.visibility = "hidden";
  clearAllSkillResistance(); // 耐性表示も削除
}

//全て閉じてcommandBtnを有効化する関数
function closeSelectCommandPopupWindowContents() {
  closeAllPopupContents();
  disableCommandBtn(false);
  displayMessage(`${parties[currentTeamIndex][currentMonsterIndex].name}のこうどう`, "コマンド？");
}

// 閉じるボタンにイベントリスナー追加
document.getElementById("closeCommandPopupWindowBtn").addEventListener("click", function () {
  closeSelectCommandPopupWindowContents();
});

function disableCommandBtn(boolean) {
  document.querySelectorAll(".commandBtn").forEach((button) => {
    button.disabled = boolean;
    if (boolean) {
      button.style.opacity = "0.2";
    } else {
      button.style.opacity = "";
    }
  });
}

//コマンド選択を終了しますか
function askFinishCommand() {
  document.getElementById("askFinishCommand").style.visibility = "visible";
  document.getElementById("commandPopupWindow").style.visibility = "visible"; //最後が防御の場合に枠を新規表示
  displayMessage("モンスターたちはやる気だ！");
  disableCommandBtn(true);
  document.getElementById("startBattleWithPresetCommandBtn").style.display = "none"; // 一応全部コマンド選択不可対応
}

//コマンド選択終了画面でno選択時、yes,no選択画面とpopup全体を閉じて5体目コマンド選択前に戻す
document.getElementById("askFinishCommandBtnNo").addEventListener("click", function () {
  document.getElementById("askFinishCommand").style.visibility = "hidden";
  document.getElementById("commandPopupWindow").style.visibility = "hidden";
  disableCommandBtn(false);

  // 最後尾の行動可能なモンスターのインデックスを取得
  currentMonsterIndex = parties[currentTeamIndex].length - 1;
  while (
    currentMonsterIndex >= 0 &&
    (isDead(parties[currentTeamIndex][currentMonsterIndex]) || parties[currentTeamIndex][currentMonsterIndex].flags.isZombie || hasAbnormality(parties[currentTeamIndex][currentMonsterIndex]))
  ) {
    currentMonsterIndex--;
  }

  // 選択中のモンスターを強調表示
  adjustMonsterIconStickOut();
  displayMessage(`${parties[currentTeamIndex][currentMonsterIndex].name}のこうどう`, "コマンド？");
});

//コマンド選択終了画面でyes選択時、コマンド選択を終了
document.getElementById("askFinishCommandBtnYes").addEventListener("click", async function () {
  await handleYesButtonClick();
});
async function handleYesButtonClick() {
  document.getElementById("askFinishCommandBtnNo").disabled = false;
  document.getElementById("askFinishCommand").style.visibility = "hidden";
  if (currentTeamIndex === 1) {
    // 初ターンのみ選択コマンドを記録
    if (fieldState.turnNum === 1) {
      recordPresetCommands();
    }
    //敵も選択終了後は、startBattleへ
    currentMonsterIndex = 0;
    currentTeamIndex = 0;
    //全員選択不能の場合の非表示解除 味方選択のみ終了時は非表示のまま、敵のコマンド選択方法選択時に再表示
    document.getElementById("closeCommandPopupWindowBtn").style.display = "block";
    //初期化
    document.getElementById("commandPopupWindow").style.visibility = "hidden";
    disableCommandBtn(true);
    //popupを閉じ、commandBtnを無効化
    prepareBattlePageIcons();
    //barとバフの反転を戻す
    await setMonsterBarDisplay(false);
    removeAllStickOut();
    startBattle();
  } else {
    //味方選択のみ終了時はyes,no選択画面を閉じ、敵のコマンド選択方法選択画面を表示
    document.getElementById("howToCommandEnemy").style.visibility = "visible";
  }
}

//敵のコマンド選択方法-player
document.getElementById("howToCommandEnemyBtnPlayer").addEventListener("click", function () {
  //全員選択不能の場合の非表示解除 敵のコマンド選択方法選択時に再表示
  document.getElementById("closeCommandPopupWindowBtn").style.display = "block";
  startSelectingCommandForFirstMonster(1);
});

//敵のコマンド選択方法-improvedAI
document.getElementById("howToCommandEnemyBtnImprovedAI").addEventListener("click", function () {
  //全員選択不能の場合の非表示解除 敵のコマンド選択方法選択時に再表示
  document.getElementById("closeCommandPopupWindowBtn").style.display = "block";
  currentMonsterIndex = 0;
  currentTeamIndex = 1;
  document.getElementById("howToCommandEnemy").style.visibility = "hidden";
  document.getElementById("commandPopupWindow").style.visibility = "hidden";
});
//ここは最大ダメージ検知AIなども含めて統合処理

//ターン開始時処理、毎ラウンド移行時とprepareBattleから起動
async function startTurn() {
  // ターン終了時loop
  for (const party of parties) {
    for (const monster of party) {
      // 亡者解除
      if (monster.flags.isZombie) {
        ascension(monster, true);
      }
    }
  }
  // ラウンド最初の昇天処理後に戦闘終了確認
  if (isBattleOver()) {
    removeAllStickOut();
    await processReviveNextTurn(true); //戦闘終了時は演出skipで蘇生を実行して終了
    return;
  }
  fieldState.turnNum++;
  console.log(`ラウンド${fieldState.turnNum}`);
  const turnNum = fieldState.turnNum;
  fieldState.cooperation = {
    lastTeamID: null,
    lastSkillType: null,
    count: 1,
    isValid: false,
  };
  if (!fieldState.isPermanentReverse) {
    delete fieldState.isReverse;
  }
  if (!fieldState.isPermanentDistorted) {
    delete fieldState.isDistorted;
  }
  delete fieldState.psychoField;
  if (fieldState.stonedBlock) {
    fieldState.stonedBlock--;
  }
  if (fieldState.stonedBlock === 0) {
    delete fieldState.stonedBlock;
  }
  if (fieldState.disableReverse) {
    fieldState.disableReverse--;
  }
  if (fieldState.disableReverse === 0) {
    delete fieldState.disableReverse;
  }
  adjustFieldStateDisplay();
  removeAllStickOut();

  //ターン開始時loop
  for (const party of parties) {
    for (const monster of party) {
      //calculateModifiedSpeed ラウンド開始時に毎ターン起動 行動順生成はコマンド選択後
      monster.modifiedSpeed = monster.currentStatus.spd * (0.985 + Math.random() * 0.03); //0.97と0.05だが+-1.5%に緩和
      //flag削除 ぼうぎょ・覆い隠す以外の身代わり
      delete monster.flags.guard;
      //ターン限定flagsを初期化
      monster.flags.thisTurn = {};
      if (monster.flags.isSubstituting && !monster.flags.isSubstituting.cover) {
        delete monster.flags.isSubstituting;
      }
      if (monster.flags.hasSubstitute && !monster.flags.hasSubstitute.cover) {
        delete monster.flags.hasSubstitute;
      }
      // ターン開始時時点のnextTurnAbilitiesを移管して初期化 これ以降にattackAbilities等の影響でnextTurnAbilitiesに追加されたものは次ターン実行
      monster.abilities.supportAbilities.nextTurnAbilitiesToExecute = [...monster.abilities.supportAbilities.nextTurnAbilities];
      monster.abilities.attackAbilities.nextTurnAbilitiesToExecute = [...monster.abilities.attackAbilities.nextTurnAbilities];
      monster.abilities.supportAbilities.nextTurnAbilities = [];
      monster.abilities.attackAbilities.nextTurnAbilities = [];
      // みがわり削除後の更新はremoveExpiredBuffsAtTurnStart内で
    }
  }
  // 前ターンの死亡によるskipThisTurnが残り、防衛指令のにおうだちなどが発動しないのを防止
  initializeMonsterCommands(0);
  initializeMonsterCommands(1);
  // ぼうぎょタグを削除
  removeAllRecede();

  //ターン経過で一律にデクリメントタイプの実行 バフ付与前に
  decreaseAllBuffDurations();
  //durationが0になったバフを消去 ターン開始時に削除(帝王の構えや予測等、removeAtTurnStart指定)
  await removeExpiredBuffsAtTurnStart();

  if (turnNum === 1) {
    displayMessage(`${parties[1][0].name}たちが あらわれた！`);
    await sleep(600);
    displayMessage("モンスターの特性が発動した！");
    // 戦闘開始時にバフを付与するapplyInitialBuffs
    for (const party of parties) {
      for (const monster of party) {
        // 戦闘開始時に付与するバフ
        const initialBuffs = Object.assign(
          {}, // 空のオブジェクトから始める
          monster.gear?.initialBuffs || {}, // monster.gear?.initialBuffs を先にマージ
          monster.attribute.initialBuffs || {} // monster.attribute.initialBuffs を後でマージ（上書き）
        );
        // バフを適用 (間隔なし、skipMessageとskipSleep: trueを渡すことで付与時messageと付与間隔を削除)
        await applyBuffsAsync(monster, initialBuffs, true, true);

        // 戦闘開始時装備特性
        if (monster.gear && gearAbilities[monster.gear.id]) {
          await gearAbilities[monster.gear.id].initialAbilities(monster);
        }
        // 戦闘開始時発動特性
        const allInitialAbilities = [...(monster.abilities?.initialAbilities || [])];
        for (const ability of allInitialAbilities) {
          // 発動不可能条件に当てはまった場合次のabilityへ
          if (ability.unavailableIf && ability.unavailableIf(monster)) {
            continue;
          }
          await ability.act(monster);
        }
        updateMonsterBuffsDisplay(monster);
      }
    }
    await sleep(600);
    for (const party of parties) {
      for (const monster of party) {
        // 戦闘開始時発動特性 天使のしるしなど敵に付与するもの
        const allInitialAttackAbilities = [...(monster.abilities?.initialAttackAbilities || [])];
        for (const ability of allInitialAttackAbilities) {
          // 発動不可能条件に当てはまった場合次のabilityへ
          if (ability.unavailableIf && ability.unavailableIf(monster)) {
            continue;
          }
          await sleep(300);
          if (!ability.disableMessage) {
            if (ability.hasOwnProperty("message")) {
              ability.message(monster);
              await sleep(300);
            } else if (ability.hasOwnProperty("name")) {
              displayMessage(`${monster.name}の特性 ${ability.name}が発動！`);
              await sleep(300);
            }
          }
          await ability.act(monster);
        }
      }
    }
    await sleep(600);
  }
  displayMessage(`ラウンド${turnNum}`, null, true);
  document.getElementById("turnNumDisplay").textContent = `残りラウンド ${11 - turnNum}`;
  await sleep(300);

  // ラザマ等
  async function processReviveNextTurn(skipSleep = false) {
    for (const party of parties) {
      for (const monster of party) {
        if (monster.flags.isDead && monster.flags.reviveNextTurn) {
          if (!skipSleep) {
            await sleep(300);
            displayMessage(`${monster.name}の特性`, `${monster.flags.reviveNextTurn} が発動！`);
            await sleep(200);
          }
          if (monster.buffs.reviveBlock && !monster.buffs.reviveBlock.unDispellableByRadiantWave) {
            delete monster.buffs.reviveBlock;
          }
          await reviveMonster(monster, 1, true, skipSleep, skipSleep);
          if (!skipSleep) {
            if (monster.abilities.reviveNextTurnAct) {
              await monster.abilities.reviveNextTurnAct(monster, monster.flags.reviveNextTurn);
            } else {
              applyDamage(monster, monster.defaultStatus.MP, -1, true); //actある場合はact内で、それ以外はここでMP全回復
            }
          }
          delete monster.flags.reviveNextTurn;
        }
      }
    }
  }
  await processReviveNextTurn(false);

  // 非同期処理でバフを適用
  async function applyBuffsAsync(monster, buffs, skipMessage = false, skipSleep = false) {
    // バフ対象の種類
    const BuffTargetType = {
      Self: "self",
      Ally: "ally",
      Enemy: "enemy",
      All: "all",
      Random: "random",
    };
    for (const buffName in buffs) {
      const buffData = buffs[buffName];
      // バフ対象の取得
      const targetType = buffData.targetType || BuffTargetType.Self; // デフォルトは自分自身
      const aliveAllys = parties[monster.teamID].filter((monster) => !monster.flags.isDead);
      const aliveEnemies = parties[monster.enemyTeamID].filter((monster) => !monster.flags.isDead);
      // バフ対象に応じた処理
      switch (targetType) {
        case BuffTargetType.Self:
          applyBuff(monster, { [buffName]: structuredClone(buffData) }, null, false, skipMessage);
          break;
        case BuffTargetType.Ally:
          for (const ally of aliveAllys) {
            // 自分除外時はally !== monster
            applyBuff(ally, { [buffName]: structuredClone(buffData) }, null, false, skipMessage);
            if (!skipSleep) await sleep(150); // skipSleep が false の場合のみ150ms待機
          }
          break;
        case BuffTargetType.Enemy:
          for (const enemy of aliveEnemies) {
            applyBuff(enemy, { [buffName]: structuredClone(buffData) }, null, false, skipMessage);
            if (!skipSleep) await sleep(150);
          }
          break;
        case BuffTargetType.All:
          //allyとenemyを両方実行
          for (const ally of aliveAllys) {
            applyBuff(ally, { [buffName]: structuredClone(buffData) }, null, false, skipMessage);
            if (!skipSleep) await sleep(150);
          }
          for (const enemy of aliveEnemies) {
            applyBuff(enemy, { [buffName]: structuredClone(buffData) }, null, false, skipMessage);
            if (!skipSleep) await sleep(150);
          }
          break;
        case BuffTargetType.Random:
          const aliveMonsters = buffData.targetTeam ? (buffData.targetTeam === "ally" ? aliveAllys : aliveEnemies) : aliveAllys;
          //未指定時はランダムな味方を対象
          const targetNum = buffData.targetNum || 1; // targetNumが指定されていない場合は1回

          for (let i = 0; i < targetNum; i++) {
            if (aliveMonsters.length > 0) {
              const randomIndex = Math.floor(Math.random() * aliveMonsters.length);
              const randomTarget = aliveMonsters[randomIndex];
              applyBuff(randomTarget, { [buffName]: structuredClone(buffData) });
              // 重複は許可
              //aliveMonsters.splice(randomIndex, 1);
              if (!skipSleep) await sleep(150);
            }
          }
          break;
      }
      if (!skipSleep) await sleep(150); //バフ適用ごとの間隔
    }
  }

  // バフ適用処理
  const applyBuffsForMonster = async (monster) => {
    if (monster.flags.isDead || monster.flags.isZombie) {
      return;
    }

    // すべてのバフをまとめる
    const allBuffs = {
      ...(monster.attribute[turnNum] || {}),
      ...(monster.attribute.permanentBuffs || {}),
      ...(monster.attribute.additionalPermanentBuffs || {}),
      ...(turnNum % 2 === 0 && monster.attribute.evenTurnBuffs ? monster.attribute.evenTurnBuffs : {}),
      ...(turnNum % 2 === 0 && monster.attribute.additionalEvenTurnBuffs ? monster.attribute.additionalEvenTurnBuffs : {}),
      ...(turnNum % 2 !== 0 && monster.attribute.oddTurnBuffs ? monster.attribute.oddTurnBuffs : {}),
      ...(turnNum >= 2 && monster.attribute.buffsFromTurn2 ? monster.attribute.buffsFromTurn2 : {}),
      ...(turnNum === 1 && monster.gear?.turn1buffs ? monster.gear.turn1buffs : {}),
    };

    // バフを適用
    await applyBuffsAsync(monster, allBuffs);
  };

  // 1モンスターのabilityを連続的に実行する関数
  async function executeAbility(monster, isSupportOrAttack) {
    //他attackAbilitiesで死亡して復活した場合もreturnせず実行
    if (monster.flags.isDead || monster.flags.isZombie || !monster.abilities || !monster.abilities[isSupportOrAttack]) {
      return;
    }

    const currentAbilities = monster.abilities?.[isSupportOrAttack];
    const allAbilities = [];

    // 各ability配列が存在し、かつ空でない場合のみ追加
    if (currentAbilities?.[turnNum]?.length) {
      allAbilities.push(...currentAbilities[turnNum]);
    }
    if (currentAbilities?.additionalPermanentAbilities?.length) {
      allAbilities.push(...currentAbilities.additionalPermanentAbilities);
    }
    if (currentAbilities?.permanentAbilities?.length) {
      allAbilities.push(...currentAbilities.permanentAbilities);
    }
    if (currentAbilities?.[turnNum % 2 === 0 ? "evenTurnAbilities" : "oddTurnAbilities"]?.length) {
      allAbilities.push(...currentAbilities[turnNum % 2 === 0 ? "evenTurnAbilities" : "oddTurnAbilities"]);
    }
    if (turnNum >= 2 && currentAbilities?.abilitiesFromTurn2?.length) {
      allAbilities.push(...currentAbilities.abilitiesFromTurn2);
    }
    if (currentAbilities?.nextTurnAbilitiesToExecute?.length) {
      allAbilities.push(...currentAbilities.nextTurnAbilitiesToExecute);
    }

    for (const ability of allAbilities) {
      // 発動不可能条件に当てはまった場合次のabilityへ
      if (monster.flags.executedAbilities.includes(ability.name) || (ability.unavailableIf && ability.unavailableIf(monster))) {
        continue;
      }
      await sleep(300);
      if (!ability.disableMessage) {
        if (ability.hasOwnProperty("message")) {
          ability.message(monster);
          await sleep(300);
        } else if (ability.hasOwnProperty("name")) {
          displayMessage(`${monster.name}の特性 ${ability.name}が発動！`);
          await sleep(300);
        }
      }
      await ability.act(monster);
      //実行後の記録
      if (ability.isOneTimeUse) {
        monster.flags.executedAbilities.push(ability.name);
      }
    }
    await sleep(150);
  }

  // カウントダウン処理
  async function executeCountDown(monster) {
    if (monster.buffs.countDown && !monster.flags.isDead && !monster.flags.isZombie) {
      // 即死防止 1ターン待つフラグを削除して終了 次ターンは通常通り死亡
      if (monster.buffs.countDown.wait1Turn) {
        delete monster.buffs.countDown.wait1Turn;
        return;
      }
      await sleep(200);
      if (monster.buffs.countDown.count === 1) {
        displayMessage("死のカウントダウンの", "効果が 発動！");
        await sleep(100);
        handleDeath(monster, false, true, null, true); // isCountDownをtrue
        displayMessage(`${monster.name}は ちからつきた！`);
        await checkRecentlyKilledFlagForPoison(monster);
      } else {
        displayMessage("死のカウントダウンが すすんだ！");
        monster.buffs.countDown.count--;
        updateMonsterBuffsDisplay(monster);
      }
      await sleep(150);
    }
  }
  async function executeTurnStartABilities(monster) {
    if (monster.flags.isDead || monster.flags.isZombie || !monster.abilities || !monster.abilities.turnStartAbilities) {
      return;
    }
    for (const ability of monster.abilities.turnStartAbilities) {
      // 発動不可能条件に当てはまった場合次のabilityへ
      if (monster.flags.executedAbilities.includes(ability.name) || (ability.unavailableIf && ability.unavailableIf(monster))) {
        continue;
      }
      await sleep(300);
      if (!ability.disableMessage) {
        if (ability.hasOwnProperty("message")) {
          ability.message(monster);
          await sleep(300);
        } else if (ability.hasOwnProperty("name")) {
          displayMessage(`${monster.name}の特性 ${ability.name}が発動！`);
          await sleep(300);
        }
      }
      await ability.act(monster);
      //実行後の記録
      if (ability.isOneTimeUse) {
        monster.flags.executedAbilities.push(ability.name);
      }
    }
    await sleep(150);
  }

  await sleep(700);
  // 開始時abilityがあれば実行 (バーン変身)
  for (const party of parties) {
    for (const monster of party) {
      await executeTurnStartABilities(monster);
    }
  }
  // partiesに順番にバフ適用・supportAbilities発動
  for (const party of parties) {
    for (const monster of party) {
      await applyBuffsForMonster(monster);
      await executeAbility(monster, "supportAbilities");
      await executeCountDown(monster);
      await executeContinuousHealing(monster);
      // 毎カウントダウン後に戦闘終了確認
      if (isBattleOver()) {
        removeAllStickOut();
        return;
      }
    }
  }

  // 行動早い含めた順番で、attackAbilitiesを実行
  function decideAbilityOrder() {
    let abilityOrder = [];
    // 全てのモンスターを1つの配列にまとめる
    let allMonsters = parties.flat();

    // 各行動順のモンスターを格納する配列を定義
    let preemptiveActionMonsters = [];
    let anchorActionMonsters = [];
    let normalMonsters = [];

    // 各モンスターの行動順を分類
    allMonsters.forEach((monster) => {
      if (monster.buffs.preemptiveAction) {
        preemptiveActionMonsters.push(monster);
      } else if (monster.buffs.anchorAction) {
        anchorActionMonsters.push(monster);
      } else {
        normalMonsters.push(monster);
      }
    });

    // currentStatus.spd で遅い順にソートし、同速の場合はランダムに並び替える関数
    const sortBySpeedAndRandomize = (a, b) => {
      const speedDiff = a.modifiedSpeed - b.modifiedSpeed;
      return speedDiff !== 0 ? speedDiff : Math.random() - 0.5;
    };

    // isReverseの状態に応じて行動順を決定
    if (fieldState.isReverse) {
      // リバース状態
      abilityOrder = [...anchorActionMonsters.sort(sortBySpeedAndRandomize), ...normalMonsters.sort(sortBySpeedAndRandomize), ...preemptiveActionMonsters.sort(sortBySpeedAndRandomize)];
    } else {
      // 通常状態は反転
      abilityOrder = [
        ...preemptiveActionMonsters.sort(sortBySpeedAndRandomize).reverse(),
        ...normalMonsters.sort(sortBySpeedAndRandomize).reverse(),
        ...anchorActionMonsters.sort(sortBySpeedAndRandomize).reverse(),
      ];
    }
    return abilityOrder;
  }
  const abilityOrder = decideAbilityOrder();
  for (const monster of abilityOrder) {
    if (!monster.buffs.stoned) {
      await executeAbility(monster, "attackAbilities");
    }
  }

  // supportとattack実行後にnextTurnAbilitiesToExecuteをすべて削除
  for (const party of parties) {
    for (const monster of party) {
      delete monster.abilities.supportAbilities.nextTurnAbilitiesToExecute;
      delete monster.abilities.attackAbilities.nextTurnAbilitiesToExecute;
      // ターン開始・コマンド開始時点に使用可能だったskillを使用可能skillリストに記録
      // 変身したターンにAIで絶望の天舞や超伝説変身後特技は使用しない 供物はOK
      monster.availableSkillsOnAIthisTurn = [...monster.skill];
      // 供物になっている場合は元skillを使用可能リストに含める
      if (monster.availableSkillsOnAIthisTurn[3] === "供物をささげる") {
        monster.availableSkillsOnAIthisTurn[3] = monster.defaultSkill[3];
      }
    }
  }

  //popupを全て閉じてコマンドボタンを有効化、メッセージ表示
  closeSelectCommandPopupWindowContents();
  startSelectingCommandForFirstMonster(0);
}

//毎ラウンドコマンド選択後処理
async function startBattle() {
  await sleep(1000);
  //1round目なら戦闘開始時flagを持つ特性等を発動
  //ラウンド開始時flagを持つ特性を発動 多分awaitする
  decideTurnOrder(parties, skill);
  //monsterの行動を順次実行
  for (const monster of turnOrder) {
    // 戦闘終了時: 順次実行を終了しstartTurn内で終了  skipの場合: 毒の処理などはするので通常通りprocessに入る
    if (isBattleOver()) {
      removeAllStickOut();
      break;
    }
    await processMonsterAction(monster);
    await sleep(450);
  }
  // 最後のmonsterの行動で戦闘終了時: returnせずstartTurn内で終了 skip: 考慮不要
  if (isBattleOver()) {
    removeAllStickOut();
  }
  await startTurn();
}

// バフ追加用関数
function applyBuff(buffTarget, newBuff, skillUser = null, isReflection = false, skipMessage = false, isDamageExisting = false) {
  if (buffTarget.flags.isDead) {
    return;
  }
  // バフを一回でも付与したかどうか追跡
  let hasAppliedBuff = false;

  // 重ねがけ可能なバフ stackableとresistanceBuffはobjectなのでhasOwnPropertyでアクセス ほかはincludes
  const stackableBuffs = {
    baiki: { max: 2, min: -2 },
    defUp: { max: 2, min: -2 },
    spdUp: { max: 2, min: -2 },
    intUp: { max: 2, min: -2 },
    spellBarrier: { max: 2, min: -2 },
    slashBarrier: { max: 2, min: -2 },
    martialBarrier: { max: 2, min: -2 },
    breathBarrier: { max: 2, min: -2 },
    fireResistance: { max: 3, min: -3 },
    iceResistance: { max: 3, min: -3 },
    thunderResistance: { max: 3, min: -3 },
    windResistance: { max: 3, min: -3 },
    ioResistance: { max: 3, min: -3 },
    lightResistance: { max: 3, min: -3 },
    darkResistance: { max: 3, min: -3 },
    zakiResistance: { max: 3, min: -3 },
  };

  // Resistance 系バフの場合の属性名
  const resistanceBuffElementMap = {
    fireResistance: "fire",
    iceResistance: "ice",
    thunderResistance: "thunder",
    windResistance: "wind",
    ioResistance: "io",
    lightResistance: "light",
    darkResistance: "dark",
    zakiResistance: "zaki",
  };

  // 状態異常系のうち、耐性判定やバリア判定を行うもの (継続ダメ・回復封じ・マソ以外)
  const abnormalityBuffs = ["spellSeal", "breathSeal", "slashSeal", "martialSeal", "fear", "tempted", "sealed", "confused", "paralyzed", "asleep", "poisoned", "dazzle", "reviveBlock", "stoned"];
  // みがわりと予測を解除
  const removeSubstituteAbnormalities = ["fear", "sealed", "tempted", "confused", "paralyzed", "asleep", "stoned"];
  // 封印とstoned以外
  const dispellableByRadiantWaveAbnormalities = [
    "spellSeal",
    "breathSeal",
    "slashSeal",
    "martialSeal",
    "fear",
    "tempted",
    "confused",
    "paralyzed",
    "asleep",
    "poisoned",
    "dazzle",
    "reviveBlock",
    "dotDamage",
    "dotMPdamage",
    "MPabsorption",
    "healBlock",
    "manaReduction",
    "powerWeaken",
    "murakumo",
    "zombifyBlock",
    "crimsonMist",
    "countDown",
    "elementalRetributionMark",
  ];
  const mindAndSealBarrierTargets = ["spellSeal", "breathSeal", "slashSeal", "martialSeal", "fear", "tempted"];

  const reflectionMap = ["spellReflection", "slashReflection", "martialReflection", "breathReflection", "danceReflection", "ritualReflection"];

  const breakBoosts = ["fireBreakBoost", "iceBreakBoost", "thunderBreakBoost", "windBreakBoost", "ioBreakBoost", "lightBreakBoost", "darkBreakBoost"];

  const familyBuffs = ["goragoAtk", "goragoSpd", "heavenlyBreath", "shamuAtk", "shamuDef", "shamuSpd", "goddessDefUp", "castleDefUp", "matterBuffAtk", "matterBuffSpd", "iburuSpdUp"];

  for (const buffName in newBuff) {
    // 0. 新規バフと既存バフを定義
    const currentBuff = buffTarget.buffs[buffName];
    const buffData = { ...newBuff[buffName] };

    // ミス表示をしないフラグがひとつでもある場合、バフ付与扱いに設定
    if (buffData.noMissDisplay) {
      hasAppliedBuff = true;
    }

    // 1. バフ非上書き条件の処理
    // 1-1. 石化には重ねがけ以外付与しない
    if (buffTarget.buffs.stoned && buffName !== "stoned") {
      continue;
    }
    // 1-2. 亡者の場合 封印(黄泉・神獣・氷の王国) 亡者の怨嗟鏡 死肉の怨嗟 憎悪の怨嗟 反撃ののろし 超魔改良 蘇生封じの術 グランドアビス 修羅の闇以外は付与しない
    if (buffTarget.flags.isZombie && !buffData.zombieBuffable) {
      continue;
    }
    // 1-3. statusLock が存在する場合は stackableBuffs と familyBuffs を付与しない ただし上位のstackableは例外
    if (buffTarget.buffs.hasOwnProperty("statusLock") && (stackableBuffs.hasOwnProperty(buffName) || familyBuffs.includes(buffName)) && !buffData.keepOnDeath && !buffData.unDispellable) {
      continue;
    }
    // 1-4. 解除不可状態異常を上書きしない
    // 上位毒・上位回復封じ等以外の、解除不可が設定されていない新規状態異常系バフに対して、光の波動で解除可能なフラグを下処理として付与
    if (dispellableByRadiantWaveAbnormalities.includes(buffName) && !buffData.unDispellableByRadiantWave) {
      buffData.dispellableByRadiantWave = true;
    }
    // 封印と石化はデフォルトで解除不可
    if (buffName === "sealed" || buffName === "stoned") {
      buffData.unDispellableByRadiantWave = true;
    }
    // もし同種状態異常が既存で、かつ既存unDispellableByRadiantWave > 新規付与dispellableByRadiantWave の場合は上書きしない
    if (currentBuff && currentBuff.unDispellableByRadiantWave && buffData.dispellableByRadiantWave) {
      continue;
    }

    // 1-5. 順位付け処理の前に自動付与
    // 蘇生封じ・マソをkeepOnDeath化
    if (buffName === "reviveBlock" || buffName === "maso") {
      buffData.keepOnDeath = true;
    }
    // breakBoostの追加付与を可能に
    if (breakBoosts.includes(buffName)) {
      buffData.divineDispellable = true;
    }
    // 1-6. keepOnDeath > unDispellable > divineDispellable > else の順位付けで負けてるときはcontinue (イブール上位リザオ、黄泉の封印vs普通、つねバイキ、トリリオン、ネル行動前バフ)
    // divineDispellableを上書き可能なバフは除外: protection
    if (currentBuff && !["protection"].includes(buffName)) {
      function getBuffPriority(buff) {
        // reviveは必ずkeepOnDeath持ちのため、3は返さずにkeepOnDeath以外で比較
        if (buffName !== "revive" && buff.keepOnDeath) return 3;
        if (buff.unDispellable) return 2;
        if (buff.divineDispellable) return 1;
        return 0;
      }
      const currentBuffPriority = getBuffPriority(currentBuff);
      const newBuffPriority = getBuffPriority(buffData);
      // currentBuffの方が優先度が高い場合は付与失敗 同格以上ならば上書き
      if (currentBuffPriority > newBuffPriority) {
        continue;
      }
    }
    // 1-7. その他個別の付与不可能条件
    // 力ため魔力覚醒所持時に侵食は付与しない
    if ((buffName === "powerWeaken" && buffTarget.buffs.powerCharge) || (buffName === "manaReduction" && buffTarget.buffs.manaBoost)) {
      continue;
    }
    // 強いprotection所持時にクリミスを付与しない
    if (buffName === "crimsonMist" && buffTarget.buffs.protection) {
      if (buffTarget.buffs.protection.keepOnDeath || buffTarget.buffs.protection.unDispellable || buffTarget.buffs.protection.divineDispellable || buffTarget.buffs.protection.strength >= 0.5) {
        continue;
      } else {
        // クリミス付与時、弱いprotの場合は上書き削除(簡略化のため確率処理前に)
        delete buffTarget.buffs.protection;
      }
    }
    // クリミス所持時に弱いprotectionの場合は付与しない
    if (buffName === "protection" && buffTarget.buffs.crimsonMist) {
      if (!(buffData.keepOnDeath || buffData.unDispellable || buffData.divineDispellable || buffData.strength >= 0.5)) {
        continue;
      } else {
        // 強いprotを付与時、クリミスを上書き削除(簡略化のため確率処理前に)
        delete buffTarget.buffs.crimsonMist;
      }
    }
    // countDownは上書きしない
    if (buffName === "countDown" && buffTarget.buffs.countDown) {
      continue;
    }
    // 猛毒には毒を付与しない
    if (buffName === "poisoned" && currentBuff && !currentBuff.isLight && buffData.isLight) {
      continue;
    }
    // ラススタ 使用済みラススタ 砕けラススタ(toukon) 不屈 使用済み不屈 砕け不屈(toukon) とうこん 使用済みとうこん
    // 既存のバフがある場合: とうこんは何も上書きしない(brokenは上書きするかもしれないが無視) 不屈はとうこん(broken含)のみ上書き 不屈・ラススタの新品/使用済みは上書きしない
    if (buffName === "isUnbreakable" && currentBuff && (buffData.isToukon || (buffData.left === 1 && !currentBuff.isToukon))) {
      continue;
    }
    // darkにworldBuffを付与しない
    if (buffName === "worldBuff" && buffTarget.buffs.darkBuff) {
      continue;
    }

    // buffData 内に probability が存在するかチェックして用意
    const probability = buffData.probability ?? 10;
    delete buffData.probability;

    // 2. 耐性バフ、状態異常、その他の順で独立して確率判定・耐性・バリアバフによる無効化処理、付与失敗時はcontinueで次へ飛ばす
    // 2-1. 耐性ダウンの場合のみ耐性をかけて処理
    if (resistanceBuffElementMap.hasOwnProperty(buffName) && buffData.strength < 0) {
      const buffElement = resistanceBuffElementMap[buffName];
      const resistance = calculateResistance(null, buffElement, buffTarget, fieldState.isDistorted, null);

      if (resistance > 0) {
        // 現在の耐性が無効未満の場合のみ耐性ダウンを適用
        const adjustedProbability = probability * resistance;
        // 確率に基づいてバフ適用を判定
        if (Math.random() > adjustedProbability) {
          continue; // 確率でバフ適用しない場合は次のバフへ
        }
      } else {
        // 現在の耐性が無効吸収の場合は適用しない
        continue; // 次のバフへ
      }
    } else if (abnormalityBuffs.includes(buffName)) {
      // 2-2. //状態異常系のうち、耐性判定 バリア判定 上書き不可能判定を行うもの (継続ダメ・回復封じ・マソ・侵食以外)
      const barrierMap = {
        fear: "mindBarrier",
        tempted: "mindBarrier",
        asleep: "sleepBarrier",
        confused: "confusionBarrier",
        paralyzed: "paralyzeBarrier",
        sealed: "sealBarrier",
        reviveBlock: "reviveBlockBarrier",
      };
      // 防壁や魔王バリアで防ぐ
      if ((buffTarget.buffs.sacredBarrier || buffTarget.buffs.demonKingBarrier) && buffName !== "sealed" && buffName !== "stoned" && buffName !== "reviveBlock") {
        continue;
      }
      // マインド封じ無効
      if (buffTarget.buffs.mindAndSealBarrier && mindAndSealBarrierTargets.includes(buffName)) {
        continue;
      }
      // バリアおよび石化封じによる無効化
      if ((barrierMap[buffName] && buffTarget.buffs[barrierMap[buffName]]) || (buffName === "stoned" && fieldState.stonedBlock)) {
        continue;
      }
      //既にほかの行動停止系状態異常にかかっているかつ新規バフがfear, tempted, sealedのときは付与しない ただし封印による行動停止上書きは例外
      const buffsToCheck = buffTarget.buffs;
      const hasOtherAbnormality = buffsToCheck.paralyzed || buffsToCheck.asleep || buffsToCheck.confused || buffsToCheck.tempted || buffsToCheck.sealed;
      // 行動停止 魅了の場合、どれかひとつでも所持している時点で失敗
      if ((buffName === "fear" || buffName === "tempted") && (hasOtherAbnormality || buffsToCheck.fear)) {
        continue;
      }
      // 封印の場合、fear以外の状態異常所持時は失敗 fearのみ上書き
      if (buffName === "sealed" && hasOtherAbnormality) {
        continue;
      }
      //耐性を参照して確率判定
      let abnormalityResistance = 1;
      //氷の王国・フロスペ・氷縛等属性処理
      if (buffData.element) {
        abnormalityResistance = calculateResistance(skillUser, buffData.element, buffTarget, fieldState.isDistorted, null);
        if (buffName === "sealed" && abnormalityResistance < 0.6) {
          // 氷の王国のみ、使い手込でも半減以上は確定失敗
          abnormalityResistance = -1;
        }
      } else {
        //氷の王国以外の状態異常系の耐性処理については、反射有無で分岐
        //反射時は逆転 反射によって逆転されているのを戻し、元々の使用者と使い手およびtargetの耐性で判定 (状態異常バリアなどは通常と同じく実施済)
        //このため追加効果の反射時は、process内で全ての場合で予測ではなくカンタ系のように、完全に反転させてapplyBuffに渡す (skillUserForAppliedEffectを使用)
        //予測のとき、自分で自分に打つので反射者の情報が欠落してしまい、反転耐性計算ができなくなるのを防止
        if (isReflection) {
          abnormalityResistance = calculateResistance(buffTarget, buffName, skillUser);
        } else {
          abnormalityResistance = calculateResistance(skillUser, buffName, buffTarget);
        }
      }
      // 種族数依存
      let sameRaceCount = 1;
      if (buffData.probabilityMultiplierBySameRace) {
        if (isReflection) {
          sameRaceCount = buffTarget ? countSameRaceMonsters(buffTarget) : 1;
        } else {
          sameRaceCount = skillUser ? countSameRaceMonsters(skillUser) : 1;
        }
      }
      // 耐性と確率処理で失敗したら次へ
      if (Math.random() > probability * abnormalityResistance * sameRaceCount) {
        continue;
      }
    } else {
      // 2-3. Resistance系バフのうち耐性計算をしない上昇分と、状態異常以外の場合の確率判定
      if (Math.random() > probability) {
        continue;
      }
    }

    // 3. 確率判定成功時にバフ適用処理 バフ付与に付随する効果の処理もここで durationやstrengthによる比較で弾く処理も
    if (stackableBuffs.hasOwnProperty(buffName)) {
      // 3-1. 重ねがけ可能バフ
      if (currentBuff && !buffData.keepOnDeath && !buffData.unDispellable) {
        // 負けている場合はcontinue済、同格の場合は重ねがけだが、勝っている(keepOnDeathやunDispellable)場合は重ねがけせず上書き
        // 重ねがけ可能かつ既にバフが存在する場合はstrength を加算 (上限と下限をチェック)
        const newStrength = Math.max(stackableBuffs[buffName].min, Math.min(currentBuff.strength + buffData.strength, stackableBuffs[buffName].max));
        if (newStrength === 0) {
          // strength が 0 になったらバフを削除して終了 付与するのにcontinueする唯一の箇所
          delete buffTarget.buffs[buffName];
          hasAppliedBuff = true;
          continue;
        } else {
          // 0以外の場合はstrengthだけ加算して新しいバフで上書き
          buffTarget.buffs[buffName] = { ...currentBuff, strength: newStrength };
        }
      } else {
        // 重ねがけ可能かつ既に存在しない場合はそのまま適用
        buffTarget.buffs[buffName] = { ...buffData };
      }
      //重ねがけ可能バフの付与成功時処理
    } else if (breakBoosts.includes(buffName)) {
      // 3-2. 重ねがけ可能なうち特殊 ブレイク深化
      if (currentBuff) {
        const newStrength = Math.min(currentBuff.strength + buffData.strength, buffData.maxStrength);
        buffTarget.buffs[buffName] = { ...currentBuff, strength: newStrength };
      } else {
        buffTarget.buffs[buffName] = { ...buffData };
      }
    } else if (buffName === "maso") {
      // 3-3. マソ(確率処理を含む)
      const increment = buffData.strength || 1;
      if (currentBuff) {
        const probability = {
          1: 0.8,
          2: 0.6,
          3: 0.4,
          4: 0,
          5: 0,
        }[currentBuff.strength];
        // strengthが指定されている場合は確定で指定分だけ上昇
        if (buffData.strength || Math.random() < probability) {
          buffTarget.buffs.maso.strength = Math.min(currentBuff.strength + increment, buffData.maxDepth);
        } else {
          continue;
        }
      } else {
        // 深度1は確定付与 初回付与ではkeepOnDeath付与
        const newStrength = Math.min(increment, buffData.maxDepth);
        buffTarget.buffs.maso = { keepOnDeath: true, strength: newStrength };
      }
    } else if (buffName === "aiExtraAttacks") {
      // 3-4. AI攻撃回数追加
      if (currentBuff) {
        const newStrength = Math.min(currentBuff.strength + 1, 2);
        buffTarget.buffs[buffName] = { ...currentBuff, strength: newStrength };
      } else {
        buffTarget.buffs[buffName] = { ...buffData };
      }
    } else if (buffName === "kiganLevel") {
      // 3-5. 鬼眼レベル追加
      if (currentBuff) {
        const maxStrength = buffData.maxStrength || 3;
        const newStrength = Math.min(currentBuff.strength + buffData.strength, maxStrength);
        buffTarget.buffs[buffName] = { ...currentBuff, strength: newStrength };
      } else {
        buffTarget.buffs[buffName] = { ...buffData };
      }
    } else if (buffName === "worldBuff") {
      // 3-5. 反撃ののろし追加
      if (currentBuff) {
        const maxStrength = 0.15;
        const newStrength = Math.min(currentBuff.strength + 0.05, maxStrength);
        buffTarget.buffs[buffName] = { ...currentBuff, strength: newStrength };
      } else {
        buffTarget.buffs[buffName] = { ...buffData };
      }
    } else {
      // 3-5. 重ねがけ不可バフの場合、基本は上書き 競合によって上書きしない場合のみ以下のcontinueで弾く
      if (currentBuff) {
        // 3-2-3. strengthが両方存在し、かつ負けてるときは付与しない (strengthで比較する系：力ため、系統バフ、反射、prot、使い手付与 上回るまたは同格の場合上書き)
        // protectionだけ例外 天界上書き処理のためにdivineと無印の比較によるcontinueを行っていないため、strengthが同値の場合にdivineを上書きしないよう指定
        if (buffName === "protection" && currentBuff.strength === buffData.strength && currentBuff.divineDispellable && !buffData.divineDispellable) {
          continue;
        } else if (currentBuff.strength && buffData.strength && currentBuff.strength > buffData.strength) {
          continue;
        }
      }
      buffTarget.buffs[buffName] = { ...buffData };
      // 重ねがけ不可の付与成功時処理
      // statusLockを付与時、既存のstackableBuffsとfamilyBuffsを削除 ただし上位のstackableは例外
      if (buffName === "statusLock") {
        const buffNames = Object.keys(buffTarget.buffs);
        for (const existingBuffName of buffNames) {
          if (
            (stackableBuffs.hasOwnProperty(existingBuffName) || familyBuffs.includes(existingBuffName)) &&
            !buffTarget.buffs[existingBuffName].keepOnDeath &&
            !buffTarget.buffs[existingBuffName].unDispellable
          ) {
            delete buffTarget.buffs[existingBuffName];
          }
        }
      }
      //状態異常の付与時発動効果(上書き等)
      //封印によるマインドの上書き 確率成功時にマインドを削除
      if (buffTarget.buffs.fear && buffName === "sealed") {
        delete buffTarget.buffs.fear;
      }
      //他状態異常によるマインド魅了封印の上書き 確率成功時にマインド魅了封印削除
      if (buffName === "confused" || buffName === "paralyzed" || buffName === "asleep") {
        delete buffTarget.buffs.fear;
        delete buffTarget.buffs.tempted;
        delete buffTarget.buffs.sealed;
      }
      //ぼうぎょ解除 マインド 封印 マヒは解除しない
      if (["tempted", "confused", "asleep", "stoned"].includes(buffName) && buffTarget.flags.guard) {
        delete buffTarget.flags.guard;
      }
      //魅了による防御バフ解除
      if (buffName === "tempted") {
        delete buffTarget.buffs.defUp;
        delete buffTarget.buffs.heavenlyBreath;
        delete buffTarget.buffs.goddessDefUp;
        delete buffTarget.buffs.castleDefUp;
      }
      //みがわり解除 みがわられは解除しない
      if (removeSubstituteAbnormalities.includes(buffName) && buffTarget.flags.isSubstituting && !buffTarget.flags.isSubstituting.cover) {
        deleteSubstitute(buffTarget);
      }
      //石化処理
      if (buffName === "stoned") {
        const buffNames = Object.keys(buffTarget.buffs);
        // 力ため系は削除 いてはとは異なり、禁忌および天使のしるしは保持 会心ガードは保持
        const keepKeys = ["tabooSeal", "angelMark", "statusLock", "preemptiveAction", "anchorAction", "nonElementalResistance", "criticalGuard"];
        for (const existingBuffName of buffNames) {
          const existingBuff = buffTarget.buffs[existingBuffName];
          //以下は残す
          if (
            !(
              keepKeys.includes(existingBuffName) ||
              stackableBuffs.hasOwnProperty(existingBuffName) ||
              existingBuff.keepOnDeath ||
              existingBuff.unDispellableByRadiantWave ||
              existingBuff.unDispellable ||
              existingBuff.divineDispellable ||
              existingBuffName === "stoned"
            )
          ) {
            delete buffTarget.buffs[existingBuffName];
          }
          // ゴルアスの場合はstackable・系統バフも消す
          if (buffData.isGolden) {
            if (stackableBuffs.hasOwnProperty(existingBuffName) || familyBuffs.includes(existingBuffName)) {
              delete buffTarget.buffs[existingBuffName];
            }
            // ダメージ上限も消す
            if (existingBuffName === "damageLimit" && !existingBuff.keepOnDeath) {
              delete buffTarget.buffs.damageLimit;
            }
          }
        }
        // 竜王杖以外のrevive, reviveBlock(keepOnDeathだが), counterAttack, sealed, 上位毒は問答無用で削除
        if (buffTarget.buffs.revive && !buffTarget.buffs.revive.unDispellable) {
          delete buffTarget.buffs.revive;
        }
        if (buffTarget.buffs.reviveBlock && !buffTarget.buffs.reviveBlock.unDispellableByRadiantWave) {
          delete buffTarget.buffs.reviveBlock;
        }
        delete buffTarget.buffs.counterAttack;
        delete buffTarget.buffs.sealed;
        delete buffTarget.buffs.poisoned;
        // 防御は解除済なのでみがわり・みがわられともに覆うであろうと解除
        deleteSubstitute(buffTarget);
        // 現状、dispellableByAbnormality指定された予測系も解除
      }
      //マホカンは自動でカンタに
      if (buffName === "spellReflection") {
        buffTarget.buffs.spellReflection.isKanta = true;
      }
      //防壁魔王バリア付与時の状態異常解除
      if (buffName === "sacredBarrier" || buffName === "demonKingBarrier") {
        executeRadiantWave(buffTarget, true); //todo: async化
      }
      //封じマインドバリア付与時の状態異常解除
      if (buffName === "mindAndSealBarrier") {
        for (const type of mindAndSealBarrierTargets) {
          delete buffTarget.buffs[type];
        }
      }
      //力ため魔力覚醒付与時の侵食解除
      if (buffName === "powerCharge") {
        delete buffTarget.buffs.powerWeaken;
      }
      if (buffName === "manaBoost") {
        delete buffTarget.buffs.manaReduction;
      }
      // 既存バフが軽度毒であり、新規付与したのも軽度毒の場合、猛毒化
      if (buffName === "poisoned" && currentBuff && currentBuff.isLight && buffData.isLight) {
        delete buffTarget.buffs.poisoned.isLight;
      }
    }
    //付与成功時処理 duration設定
    const buffDurations = {
      //decreaseTurnEnd 行動前後がデクリメントに寄与しないタイプ stackableと反射系
      baiki: {
        16: 3,
        48: 4,
        78: 5,
        100: 6,
      },
      defUp: {
        63: 3,
        88: 4,
        98: 5,
        100: 6,
      },
      spdUp: {
        63: 3,
        88: 4,
        98: 5,
        100: 6,
      },
      intUp: {
        63: 3,
        88: 4,
        98: 5,
        100: 6,
      },
      spellBarrier: {
        69: 4,
        94: 5,
        99: 6,
        100: 7,
      },
      slashBarrier: {
        69: 4,
        94: 5,
        99: 6,
        100: 7,
      },
      martialBarrier: {
        69: 4,
        94: 5,
        99: 6,
        100: 7,
      },
      breathBarrier: {
        63: 4,
        93: 5,
        99: 6,
        100: 7,
      },
      preemptiveAction: {
        100: 1,
      },
      anchorAction: {
        100: 1,
      },
      dodgeBuff: {
        100: 1,
      },
      //decreaseBeforeAction 行動前にデクリメントして消える
      manaBoost: {
        100: 2,
      },
      powerCharge: {
        100: 2,
      },
      breathCharge: {
        100: 2,
      },
      nonElementalResistance: {
        100: 3,
      },
      demonKingBarrier: {
        100: 3,
      },
      fear: {
        100: 2,
      },
      tempted: {
        100: 2,
      },
      sealed: {
        100: 2,
      },
      confused: {
        55: 2,
        87: 3,
        99: 4,
        100: 5,
      },
      paralyzed: {
        55: 2,
        87: 3,
        99: 4,
        100: 5,
      },
      asleep: {
        68: 2,
        88: 3,
        97: 4,
        100: 5,
      },
      poisoned: {
        41: 4,
        78: 5,
        97: 6,
        100: 7,
      },
      dazzle: {
        16: 3,
        49: 4,
        83: 5,
        100: 6,
      },
      spellSeal: {
        41: 4,
        78: 5,
        97: 6,
        100: 7,
      },
      breathSeal: {
        41: 4,
        78: 5,
        97: 6,
        100: 7,
      },
      slashSeal: {
        41: 4,
        78: 5,
        97: 6,
        100: 7,
      },
      martialSeal: {
        41: 4,
        78: 5,
        97: 6,
        100: 7,
      },
    };

    const getDuration = (buffName) => {
      const durations = buffDurations[buffName];
      const randomValue = Math.random() * 100;
      for (const threshold in durations) {
        if (randomValue < threshold) {
          return durations[threshold];
        }
      }
    };
    //duration表に含まれるバフかつduration未指定の場合のみduration更新 (力ため等は自動設定だが、帝王の構えなどduration設定時は自動設定しない) さらに上位蘇生封じや常バイキ等の場合も設定しない
    if (buffName in buffDurations && !buffData.hasOwnProperty("duration") && !buffData.hasOwnProperty("keepOnDeath")) {
      buffTarget.buffs[buffName].duration = getDuration(buffName);
    }

    //継続時間指定されている場合に、デクリメントのタイプを設定
    if (buffTarget.buffs[buffName].hasOwnProperty("duration")) {
      //decreaseTurnEnd: ターン経過で一律にデクリメント 行動前後はデクリメントに寄与しない
      //うち、removeAtTurnStartなし： 各monster行動前に削除  付与されたnターン後の行動前に切れる
      // stackable スキルターン
      //うち、removeAtTurnStart付与： ターン最初に削除  付与されたnターン後のターン最初に切れる
      const removeAtTurnStartBuffs = ["reviveBlock", "preemptiveAction", "anchorAction", "stoned", "damageLimit", "dodgeBuff"];
      if (removeAtTurnStartBuffs.includes(buffName) && !buffTarget.buffs[buffName].decreaseTurnEnd && !buffTarget.buffs[buffName].decreaseBeforeAction) {
        buffTarget.buffs[buffName].removeAtTurnStart = true;
      }
      //stackableBuffs または  removeAtTurnStartを所持 (初期設定or removeAtTurnStartBuffsによる自動付与) または既に手動設定されている場合
      if (buffName in stackableBuffs || buffTarget.buffs[buffName].removeAtTurnStart || buffTarget.buffs[buffName].decreaseTurnEnd) {
        buffTarget.buffs[buffName].decreaseTurnEnd = true;
      } else {
        //decreaseBeforeAction: 行動前にデクリメント 発動してからn回目の行動直前に削除 それ以外にはこれを自動付与
        //removeAtTurnStartなし：行動前のデクリメント後にそのまま削除
        buffTarget.buffs[buffName].decreaseBeforeAction = true;
      }
    }

    //状態異常付与時、dispellableByAbnormality指定された予測系を解除
    if (removeSubstituteAbnormalities.includes(buffName)) {
      for (const reflection of reflectionMap) {
        if (
          buffTarget.buffs[reflection] &&
          !buffTarget.buffs[reflection].keepOnDeath &&
          buffTarget.buffs[reflection].dispellableByAbnormality &&
          !(buffTarget.buffs[reflection].dispellableBySpecificAbnormality && (buffName === "fear" || buffName === "tempted" || buffName === "sealed"))
        ) {
          delete buffTarget.buffs[reflection];
        }
      }
      // 反撃状態も解除
      if (buffTarget.buffs.counterAttack) {
        delete buffTarget.buffs.counterAttack;
      }
    }
    //反射の場合にエフェクト追加
    if (reflectionMap.includes(buffName) && !buffTarget.buffs[buffName].skipReflectionEffect) {
      addMirrorEffect(buffTarget.iconElementId);
    }
    if (!skipMessage) {
      displayBuffMessage(buffTarget, buffName, buffData);
    }
    hasAppliedBuff = true;
  }
  updateCurrentStatus(buffTarget); // バフ全て追加後に該当monsterのcurrentStatusを更新
  updateMonsterBuffsDisplay(buffTarget);
  // 全部付与失敗時&&ダメージが存在しない場合はmiss表示
  if (!hasAppliedBuff && !isDamageExisting) {
    displayMiss(buffTarget);
  }
}

// ターン経過でデクリメントするタイプ decreaseTurnEnd
function decreaseAllBuffDurations() {
  for (const party of parties) {
    for (const monster of party) {
      // ターン経過で減少するバフの持続時間を減少
      for (const buffName in monster.buffs) {
        const buff = monster.buffs[buffName];
        // duration プロパティが存在し、decreaseTurnEndがtrueの場合のみデクリメント
        if (buff.duration !== undefined && buff.decreaseTurnEnd) {
          buff.duration--;
        }
      }
    }
  }
}

// 行動直前に持続時間を減少させる decreaseBeforeAction
function decreaseBuffDurationBeforeAction(monster) {
  for (const buffName in monster.buffs) {
    const buff = monster.buffs[buffName];
    // duration プロパティが存在し、decreaseBeforeActionがtrueの場合のみデクリメント
    if (buff.duration !== undefined && buff.decreaseBeforeAction) {
      buff.duration--;
    }
  }
}

// durationが0になったバフを消去 行動直前に削除(通常タイプ)
async function removeExpiredBuffs(monster) {
  for (const buffName of Object.keys(monster.buffs)) {
    const buff = monster.buffs[buffName];
    // duration プロパティが存在し、かつ 0 以下で、removeAtTurnStartがfalseの場合に削除
    if (buff.hasOwnProperty("duration") && buff.duration <= 0 && !buff.removeAtTurnStart) {
      console.log(`${fieldState.turnNum}R:${monster.name}の${buffName}の効果が行動前に切れた!`);
      delete monster.buffs[buffName];
    }
  }
  updateCurrentStatus(monster);
  await updateMonsterBuffsDisplay(monster);
}

// durationが0になったバフを消去 ターン開始時(帝王の構えや予測等、removeAtTurnStart指定)
async function removeExpiredBuffsAtTurnStart() {
  for (const party of parties) {
    for (const monster of party) {
      for (const buffName of Object.keys(monster.buffs)) {
        const buff = monster.buffs[buffName];
        // duration プロパティが存在し、かつ 0 以下で、removeAtTurnStartがtrueの場合に削除
        if (buff.hasOwnProperty("duration") && buff.duration <= 0 && buff.removeAtTurnStart) {
          console.log(`${fieldState.turnNum}R開始時:${monster.name}の${buffName}の効果が切れた!`);
          delete monster.buffs[buffName];
        }
      }
      updateCurrentStatus(monster);
      await updateMonsterBuffsDisplay(monster);
    }
  }
}

// currentStatusを更新する関数
// applyBuffの追加時および持続時間切れ、解除時に起動
function updateCurrentStatus(monster) {
  // currentStatus を defaultStatus の値で初期化
  monster.currentStatus.atk = monster.defaultStatus.atk;
  monster.currentStatus.def = monster.defaultStatus.def;
  monster.currentStatus.spd = monster.defaultStatus.spd;
  monster.currentStatus.int = monster.defaultStatus.int;

  const strengthMultipliersForDef = {
    0: 0.6, // -2 + 2
    1: 0.8, // -1 + 2
    3: 1.2, //  1 + 2
    4: 1.4, //  2 + 2
  };
  const strengthMultipliersForSpdInt = {
    0: 0.25, // -2 + 2
    1: 0.5, // -1 + 2
    3: 1.5, //  1 + 2
    4: 2, //  2 + 2
  };

  // 通常バフ バイキ除く
  if (monster.buffs.defUp) {
    const strengthKey = monster.buffs.defUp.strength + 2;
    const Multiplier = strengthMultipliersForDef[strengthKey];
    monster.currentStatus.def *= Multiplier;
  }
  if (monster.buffs.spdUp) {
    const strengthKey = monster.buffs.spdUp.strength + 2;
    const Multiplier = strengthMultipliersForSpdInt[strengthKey];
    monster.currentStatus.spd *= Multiplier;
  }
  if (monster.buffs.intUp) {
    const strengthKey = monster.buffs.intUp.strength + 2;
    const Multiplier = strengthMultipliersForSpdInt[strengthKey];
    monster.currentStatus.int *= Multiplier;
  }

  //内部バフと系統バフ 1.5ではなく0.5等と指定することに注意
  // 攻撃
  let atkMultiplier = 1;
  if (monster.buffs.internalAtkUp) {
    atkMultiplier += monster.buffs.internalAtkUp.strength;
  }
  // ゴラゴ
  if (monster.buffs.goragoAtk) {
    atkMultiplier += monster.buffs.goragoAtk.strength;
  }
  // シャムダ
  if (monster.buffs.shamuAtk) {
    atkMultiplier += monster.buffs.shamuAtk.strength;
  }
  // マター
  if (monster.buffs.matterBuffAtk) {
    atkMultiplier += monster.buffs.matterBuffAtk.strength;
  }
  monster.currentStatus.atk *= atkMultiplier;

  // 防御
  let defMultiplier = 1;
  if (monster.buffs.internalDefUp) {
    defMultiplier += monster.buffs.internalDefUp.strength;
  }
  // アズ
  if (monster.buffs.heavenlyBreath) {
    defMultiplier -= 0.2;
  }
  // シャムダ
  if (monster.buffs.shamuDef) {
    defMultiplier += monster.buffs.shamuDef.strength;
  }
  // ゴッデス
  if (monster.buffs.goddessDefUp) {
    defMultiplier += monster.buffs.goddessDefUp.strength;
  }
  // 城
  if (monster.buffs.castleDefUp) {
    defMultiplier += monster.buffs.castleDefUp.strength;
  }
  // 系統爪防御力20%錬金
  if (monster.gear?.name === "系統爪ザキ&防御力20%") {
    defMultiplier += 0.2;
  }
  monster.currentStatus.def *= defMultiplier;

  // 素早さ
  let spdMultiplier = 1;
  if (monster.buffs.internalSpdUp) {
    spdMultiplier += monster.buffs.internalSpdUp.strength;
    if (monster.buffs.tabooSeal) {
      spdMultiplier -= 0.5;
    }
  }
  // ゴラゴ
  if (monster.buffs.goragoSpd) {
    spdMultiplier += monster.buffs.goragoSpd.strength;
  }
  // シャムダ
  if (monster.buffs.shamuSpd) {
    spdMultiplier += monster.buffs.shamuSpd.strength;
  }
  // マター
  if (monster.buffs.matterBuffSpd) {
    spdMultiplier += monster.buffs.matterBuffSpd.strength;
  }
  // イブール
  if (monster.buffs.iburuSpdUp) {
    spdMultiplier += monster.buffs.iburuSpdUp.strength;
  }
  monster.currentStatus.spd *= spdMultiplier;

  // 賢さ
  let intMultiplier = 1;
  if (monster.buffs.internalIntUp) {
    intMultiplier += monster.buffs.internalIntUp.strength;
  }
  monster.currentStatus.int *= intMultiplier;
}

// 行動順を決定する関数 コマンド決定後にstartBattleで起動
function decideTurnOrder(parties) {
  // 全てのモンスターを1つの配列にまとめる
  let allMonsters = parties.flat();

  // 各行動順のモンスターを格納する配列を定義
  let preemptiveSupportMonsters = [];
  let preemptiveAttackMonsters = [];
  let preemptiveActionMonsters = [];
  let normalMonsters = [];
  let anchorActionMonsters = [];
  let anchorMonsters = [];

  // 各モンスターの行動順を分類 (skillのorderと行動早い・遅いの重複所持時はskillのorder優先で分類)
  allMonsters.forEach((monster) => {
    const skillInfo = findSkillByName(monster.commandInput);
    if (skillInfo?.order === "preemptive" && (skillInfo.preemptiveGroup === 7 || skillInfo.preemptiveGroup === 8)) {
      preemptiveAttackMonsters.push(monster);
    } else if (skillInfo?.order === "preemptive") {
      preemptiveSupportMonsters.push(monster);
    } else if (skillInfo?.order === "anchor") {
      anchorMonsters.push(monster);
    } else if (monster.buffs.preemptiveAction) {
      preemptiveActionMonsters.push(monster);
    } else if (monster.buffs.anchorAction) {
      anchorActionMonsters.push(monster);
    } else {
      normalMonsters.push(monster);
    }
  });
  //死亡もしくはAIのモンスターも行動しないだけでpreemptiveActionMonsters, anchorActionMonsters, normalMonstersのいずれかに格納される

  //初期化
  turnOrder = [];

  // preemptiveSupportMonsters用 preemptiveGroupが小さい順にsort 同じ場合左から (リバース通常共通)
  const sortByPreemptiveGroup = (a, b) => {
    const skillA = findSkillByName(a.commandInput);
    const skillB = findSkillByName(b.commandInput);
    return skillA?.preemptiveGroup - skillB?.preemptiveGroup;
  };

  if (fieldState.isReverse) {
    // --- リバース状態の処理 ---
    // 各グループのソート処理を関数化 遅い順
    const sortByPreemptiveGroupAndReverseSpeed = (a, b) => {
      const skillA = findSkillByName(a.commandInput);
      const skillB = findSkillByName(b.commandInput);
      if (skillA?.preemptiveGroup !== skillB?.preemptiveGroup) {
        return skillA?.preemptiveGroup - skillB?.preemptiveGroup;
      } else if (a.modifiedSpeed !== b.modifiedSpeed) {
        return a.modifiedSpeed - b.modifiedSpeed;
      } else {
        return Math.random() - 0.5; // 同じ場合はランダム
      }
    };

    // speedでソートし、同じspeedの場合はランダムにするヘルパー関数
    const sortBySpeedReverseRandom = (a, b) => {
      if (a.currentStatus.spd !== b.currentStatus.spd) {
        return a.currentStatus.spd - b.currentStatus.spd; // 遅い順
      } else {
        return Math.random() - 0.5; // 同じ場合はランダム
      }
    };
    const sortByModifiedSpeedReverseRandom = (a, b) => {
      if (a.modifiedSpeed !== b.modifiedSpeed) {
        return a.modifiedSpeed - b.modifiedSpeed; // 遅い順
      } else {
        return Math.random() - 0.5; // 同じ場合はランダム
      }
    };

    // 1. preemptiveGroup 1-6 を追加 (preemptiveGroupの小さい順、modifiedSpeedソートやランダム化はせず左から順)
    turnOrder.push(...preemptiveSupportMonsters.sort(sortByPreemptiveGroup));

    // 2. アンカー技を使うモンスターを追加 (anchorAction所持, 特性未所持, preemptiveAction所持の順、各グループ内ではspdの遅い順)
    turnOrder.push(
      ...anchorMonsters.filter((monster) => monster.buffs.anchorAction).sort(sortBySpeedReverseRandom),
      ...anchorMonsters.filter((monster) => !monster.buffs.anchorAction && !monster.buffs.preemptiveAction).sort(sortByModifiedSpeedReverseRandom),
      ...anchorMonsters.filter((monster) => monster.buffs.preemptiveAction).sort(sortBySpeedReverseRandom)
    );

    // 3. anchorActionを持つモンスターを追加 (currentStatus.spdの遅い順)
    turnOrder.push(...anchorActionMonsters.sort(sortBySpeedReverseRandom));

    // 4. 通常の行動順のモンスターを追加 (modifiedSpeedの遅い順)
    turnOrder.push(...normalMonsters.sort(sortByModifiedSpeedReverseRandom));

    // 5. preemptiveActionを持つモンスターを追加 (currentStatus.spdの遅い順)
    turnOrder.push(...preemptiveActionMonsters.sort(sortBySpeedReverseRandom));

    // 6. preemptiveGroup 7-8 を追加 (preemptiveGroupの小さい順、modifiedSpeedの遅い順) 行動早い持ちの先制特技は加味していない
    turnOrder.push(...preemptiveAttackMonsters.sort(sortByPreemptiveGroupAndReverseSpeed));
  } else {
    // --- 通常状態の処理 ---
    // 各グループのソート処理を関数化 早い順
    const sortByPreemptiveGroupAndSpeed = (a, b) => {
      const skillA = findSkillByName(a.commandInput);
      const skillB = findSkillByName(b.commandInput);
      if (skillA?.preemptiveGroup !== skillB?.preemptiveGroup) {
        return skillA?.preemptiveGroup - skillB?.preemptiveGroup;
      } else if (a.modifiedSpeed !== b.modifiedSpeed) {
        return b.modifiedSpeed - a.modifiedSpeed;
      } else {
        return Math.random() - 0.5; // 同じ場合はランダム
      }
    };
    // speedでソートし、同じspeedの場合はランダムにするヘルパー関数
    const sortBySpeedRandom = (a, b) => {
      if (a.currentStatus.spd !== b.currentStatus.spd) {
        return b.currentStatus.spd - a.currentStatus.spd; // 早い順
      } else {
        return Math.random() - 0.5; // 同じ場合はランダム
      }
    };
    const sortByModifiedSpeedRandom = (a, b) => {
      if (a.modifiedSpeed !== b.modifiedSpeed) {
        return b.modifiedSpeed - a.modifiedSpeed; // 早い順
      } else {
        return Math.random() - 0.5; // 同じ場合はランダム
      }
    };

    // 1. preemptiveGroup 1-6 を追加 (preemptiveGroupの小さい順、modifiedSpeedソートやランダム化はせず左から順)
    turnOrder.push(...preemptiveSupportMonsters.sort(sortByPreemptiveGroup));

    // 2. preemptiveGroup 7-8 を追加 (preemptiveGroupの小さい順、modifiedSpeedの早い順) 行動早い持ちの先制特技は加味していない
    turnOrder.push(...preemptiveAttackMonsters.sort(sortByPreemptiveGroupAndSpeed));

    // 3. preemptiveActionを持つモンスターを追加 (currentStatus.spdの早い順)
    turnOrder.push(...preemptiveActionMonsters.sort(sortBySpeedRandom));

    // 4. 通常の行動順のモンスターを追加 (modifiedSpeedの早い順)
    turnOrder.push(...normalMonsters.sort(sortByModifiedSpeedRandom));

    // 5. anchorActionを持つモンスターを追加 (currentStatus.spdの早い順)
    turnOrder.push(...anchorActionMonsters.sort(sortBySpeedRandom));

    // 6. アンカー技を使うモンスターを追加 (preemptiveAction持ち-> 通常行動 -> anchorAction持ち)
    turnOrder.push(
      ...anchorMonsters.filter((monster) => monster.buffs.preemptiveAction).sort(sortBySpeedRandom),
      ...anchorMonsters.filter((monster) => !monster.buffs.anchorAction && !monster.buffs.preemptiveAction).sort(sortByModifiedSpeedRandom),
      ...anchorMonsters.filter((monster) => monster.buffs.anchorAction).sort(sortBySpeedRandom)
    );
  }
  console.log(turnOrder);
  return turnOrder;
}

// 各monsterの行動を実行する関数
async function processMonsterAction(skillUser) {
  // damagedMonstersを用意
  const damagedMonsters = [];
  // 1. バフ状態異常継続時間確認
  // 行動直前に持続時間を減少させる decreaseBeforeAction
  decreaseBuffDurationBeforeAction(skillUser);
  // durationが0になったバフを消去 行動直前に削除(通常タイプ)
  await removeExpiredBuffs(skillUser);

  removeAllStickOut();

  // 2. 死亡確認
  if (skillUser.commandInput === "skipThisTurn") {
    return; // 行動前に一回でも死んでいたら処理をスキップ
  }

  // 行動skip確認
  if (isBattleOver()) {
    removeAllStickOut();
    return;
  } else if (hasAbnormality(skillUser)) {
    // 状態異常の場合は7. 行動後処理にスキップ
    document.getElementById(skillUser.iconElementId).parentNode.classList.add("stickOut");
    const abnormalityMessage = hasAbnormality(skillUser);
    console.log(`${skillUser.name}は${abnormalityMessage}`);
    displayMessage(`${skillUser.name}は`, `${abnormalityMessage}`);
    await postActionProcess(skillUser, null, null, damagedMonsters);
    return;
  } else if (skipThisMonsterAction(skillUser)) {
    // 行動skipの場合は7. 行動後処理にスキップ
    document.getElementById(skillUser.iconElementId).parentNode.classList.add("stickOut");
    waitingMessage(skillUser);
    await sleep(200);
    await postActionProcess(skillUser, null, null, damagedMonsters);
    return;
  }

  let executingSkill;

  // 状態異常判定をクリア後、normalAICommandの場合はAIタイプごとに応じて特技とtargetを設定
  if (skillUser.commandInput === "normalAICommand") {
    const result = getMonsterAiCommand(skillUser);
    executingSkill = result[0];
    skillUser.commandTargetInput = result[1] ? result[1].index : null;
    col(`AI${skillUser.currentAiType}で${executingSkill.name}を選択`);
  } else {
    executingSkill = findSkillByName(skillUser.commandInput);
  }

  if (executingSkill.name === "ぼうぎょ") {
    document.getElementById(skillUser.iconElementId).parentNode.classList.add("recede");
  } else {
    document.getElementById(skillUser.iconElementId).parentNode.classList.add("stickOut");
  }

  // 4. 特技封じ確認
  if (skillUser.buffs[executingSkill.type + "Seal"] && !executingSkill.skipSkillSealCheck) {
    // 特技封じされている場合は7. 行動後処理にスキップ
    const skillTypes = {
      spell: "呪文",
      slash: "斬撃",
      martial: "体技",
      breath: "息",
    };
    console.log(`${skillTypes[executingSkill.type]}はふうじこめられている！`);
    displayMessage(`${skillTypes[executingSkill.type]}はふうじこめられている！`);
    await postActionProcess(skillUser, null, null, damagedMonsters);
    return;
  }

  // 5. 消費MP確認
  const MPused = calculateMPcost(skillUser, executingSkill);
  if (hasEnoughMpForSkill(skillUser, executingSkill)) {
    skillUser.currentStatus.MP -= MPused;
    updateMonsterBar(skillUser);
  } else {
    console.log("しかし、MPが足りなかった！");
    displayMessage("しかし、MPが足りなかった！");
    // MP不足の場合は7. 行動後処理にスキップ
    await postActionProcess(skillUser, null, null, damagedMonsters);
    return;
  }

  // 6. スキル実行処理の前に連携状態を確認
  const currentTeamID = skillUser.teamID;
  const previousTeamID = fieldState.cooperation.lastTeamID;
  const previousSkillType = fieldState.cooperation.lastSkillType;
  const isCooperationValid = fieldState.cooperation.isValid;
  // 前回の行動と同じチームID・typeかつ、通常攻撃やダメージ無しではないときに連携
  if (isCooperationValid && currentTeamID === previousTeamID && executingSkill.type === previousSkillType && executingSkill.type !== "notskill" && executingSkill.howToCalculate !== "none") {
    // 100%連携継続
    fieldState.cooperation.count++;
    console.log("100%の連携継続が発生");
    console.log(`${fieldState.cooperation.count}連携!`);
    showCooperationEffect(currentTeamID, fieldState.cooperation.count);
  } else if (isCooperationValid && currentTeamID === previousTeamID && executingSkill.type !== "notskill" && executingSkill.howToCalculate !== "none" && Math.random() < 0.33) {
    // 33%の確率で連携継続
    fieldState.cooperation.count++;
    console.log("33%の連携継続が発生");
    console.log(`${fieldState.cooperation.count}連携!`);
    showCooperationEffect(currentTeamID, fieldState.cooperation.count);
  } else {
    // 連携リセット
    fieldState.cooperation.count = 1;
    console.log("連携reset");
  }
  // スキル実行前に連携情報を更新
  fieldState.cooperation.lastTeamID = currentTeamID;
  fieldState.cooperation.lastSkillType = executingSkill.type;
  // ダメージなしやskill以外のときはfalseに設定し、ダメージなし等から連携が継続しないように
  if (executingSkill.type === "notskill" || executingSkill.howToCalculate === "none") {
    fieldState.cooperation.isValid = false;
  } else {
    fieldState.cooperation.isValid = true;
  }

  // 6. スキル実行処理
  console.log(`${skillUser.name}のコマンド行動: ${executingSkill.name}を使用`);
  displaySkillExecutionMessage(skillUser, executingSkill);
  if (executingSkill.name === "ぼうぎょ") {
    await sleep(40); // スキル実行前に待機時間を設ける
  } else {
    await sleep(200);
  }
  const skillTargetTeam = executingSkill.targetTeam === "enemy" ? parties[skillUser.enemyTeamID] : parties[skillUser.teamID];
  let executedSkills = [];
  const commandTarget = skillUser.commandTargetInput === null ? null : skillTargetTeam[skillUser.commandTargetInput];
  executedSkills = await executeSkill(skillUser, executingSkill, commandTarget, true, damagedMonsters, false, false, MPused);

  // 7. 行動後処理 かつ状態異常や特技封じ、MP確認で離脱せず正常に特技を実行した時のみ実行する処理
  if (executingSkill.isOneTimeUse) {
    skillUser.flags.unavailableSkills.push(executingSkill.name);
  }
  // オムド処理 特技実行後、全てのmonsterのwillTransformを削除
  for (const party of parties) {
    for (const monster of party) {
      delete monster.flags.willTransformOmudo;
    }
  }
  if (skillUser.name === "魔扉の災禍オムド・レクス" && executingSkill.type !== "notskill") {
    skillUser.flags.willTransformOmudo = true;
  }

  await postActionProcess(skillUser, executingSkill, executedSkills, damagedMonsters);
}

function displaySkillExecutionMessage(skillUser, executingSkill) {
  const skillName = executingSkill.displayName || executingSkill.name;
  if (executingSkill.specialMessage) {
    executingSkill.specialMessage(skillUser.name, skillName);
  } else if (executingSkill.type === "spell") {
    displayMessage(`${skillUser.name}は`, `${skillName}を となえた！`);
  } else if (executingSkill.type === "slash") {
    displayMessage(`${skillUser.name}は`, `${skillName}を はなった！`);
  } else if (executingSkill.name === "ぼうぎょ") {
    displayMessage(`${skillUser.name}は身を守っている！`);
  } else if (executingSkill.type === "notskill") {
    displayMessage(`${skillUser.name}の攻撃！`);
  } else {
    displayMessage(`${skillUser.name}の`, `${skillName}！`);
  }
}

// 行動後処理  正常実行後だけでなく 状態異常 特技封じ MP不足等executingSkill未実行でnullの時にerrorにならないよう注意 特にunavailableIf
async function postActionProcess(skillUser, executingSkill = null, executedSkills = null, damagedMonsters) {
  // 7-1. 死亡確認 各処理の前にskipThisTurn所持確認を行う todo: 超伝説の自動MP回復は実行する可能性あり
  if (skillUser.commandInput === "skipThisTurn") {
    return;
  }

  // 7-2. ナドラガ領界判定 skill実行が行われており、かつ対応したdomainの場合にtrueフラグを立てておく 死亡判定は後で
  let domainCheck = false;
  if (skillUser.name === "邪竜神ナドラガ" && executingSkill) {
    const targetDomain = {
      翠嵐の息吹: "thunderDomain",
      竜の波濤: "iceDomain",
      冥闇の息吹: "darkDomain",
      業炎の息吹: "fireDomain",
    }[executingSkill.name];
    if (skillUser.buffs[targetDomain]) {
      domainCheck = true;
    }
  }

  if (isBattleOver()) return; // 処理全体の実行前に戦闘終了check 毒や継続を実行せず即時return
  // 7-3. AI追撃処理 処理全体の実行前に初回skip確認
  if (skillUser.AINormalAttack && !skipThisMonsterAction(skillUser) && skillUser.commandInput !== "skipThisTurn" && !hasAbnormality(skillUser)) {
    const noAIskills = ["黄泉の封印", "神獣の封印", "けがれの封印", "供物をささげる", "超魔改良", "しはいのさくせん"];
    const AIskills = ["火竜変化呪文先制"];
    // executingSkillが存在しなければ常にAIを出す それ以外の場合は特技の性質に依存
    if (!executingSkill || AIskills.includes(executingSkill.name) || (!noAIskills.includes(executingSkill.name) && !(executingSkill.order && !isDamageExistingSkill(executingSkill)))) {
      let attackTimes =
        skillUser.AINormalAttack.length === 1
          ? skillUser.AINormalAttack[0] - 1
          : Math.floor(Math.random() * (skillUser.AINormalAttack[1] - skillUser.AINormalAttack[0] + 1)) + skillUser.AINormalAttack[0] - 1;
      if (skillUser.buffs.aiExtraAttacks) {
        attackTimes += skillUser.buffs.aiExtraAttacks.strength;
      }
      if (isBreakMonster(skillUser) && skillUser.gear && skillUser.gear.name === "ハザードネイル") {
        attackTimes++;
      }
      if (attackTimes > 0) {
        await sleep(300);
      }
      for (let i = 0; i < attackTimes; i++) {
        await sleep(270); // 追撃ごとに待機時間
        // 追撃の種類とtargetを決定
        let pursuitSkillInfo = findSkillByName(getNormalAttackName(skillUser));
        let pursuitTarget = decideNormalAttackTarget(skillUser);
        // 通常攻撃が変化していない場合のみ、さくせん行動判定をして上書き
        if (pursuitSkillInfo.name === "通常攻撃" && skillUser.buffs.aiPursuitCommand) {
          const result = getMonsterAiCommand(skillUser);
          pursuitSkillInfo = result[0];
          pursuitTarget = result[1];
          // MP消費(MP不足の特技はAI選択内で弾かれているので、単純にMP消費のみ実行)
          const MPcost = calculateMPcost(skillUser, pursuitSkillInfo);
          skillUser.currentStatus.MP -= MPcost;
          updateMonsterBar(skillUser);
          // さくせん行動は特殊message表示
          displaySkillExecutionMessage(skillUser, pursuitSkillInfo);
          col(`${skillUser.name}の追撃${i + 1}回目(さくせん行動) AI${skillUser.currentAiType}により${pursuitSkillInfo.name}で追撃`);
          await sleep(120);
        } else {
          displayMessage(`${skillUser.name}の攻撃！`);
          col(`${skillUser.name}の追撃${i + 1}回目 ${pursuitSkillInfo.name}で追撃`);
        }

        await sleep(150);
        // 通常攻撃を実行 (反撃対象, damagedMonstersとisAIを渡す)
        await executeSkill(skillUser, pursuitSkillInfo, pursuitTarget, false, damagedMonsters, true, false, null);
        // skill実行完了のたびに確認
        if (isBattleOver()) {
          return; // 毒や継続を実行せず即時return
        } else if (skipThisMonsterAction(skillUser)) {
          break; // skip状態の場合は毒や継続を続けて実行
        }
      }
    }
  }

  if (isBattleOver()) return; // 処理全体の実行前に戦闘終了check 毒や継続を実行せず即時return
  // 7-4. AI追撃後発動skill (非反撃対象 非断罪対象) executingSkillがnullの場合は実行しない 処理全体の実行前に初回skip確認
  if (!skipThisMonsterAction(skillUser) && skillUser.commandInput !== "skipThisTurn" && executingSkill) {
    const skillsToExecute = [];
    // skill本体に依存する追加特技(仮) 反射で状態異常になっても発動 反射死しても使用する模様?   todo: 破壊衝動解除では追加せず、復活後限定
    if (["昏睡のカギ爪", "殺りくの雷刃"].includes(executingSkill.name)) {
      skillsToExecute.push({ skillInfo: executingSkill, firstMessage: "破壊衝動の効果により", lastMessage: `もう一度 ${executingSkill.name}を はなった！` });
    }
    // 錬金依存の追加特技: 追加で咆哮など
    //if (skillUser.gear?.alchemy?.some((alchemy) => alchemy.additionalSkillName === executingSkill.name)) {
    if ((skillUser.gear?.skillAlchemy === executingSkill.name && executingSkill.name === "咆哮") || (executingSkill.name === "凶帝王の双閃" && skillUser.gear?.name === "凶帝王のつるぎ")) {
      const followingSkillData = executingSkill.additionalVersion ? findSkillByName(executingSkill.additionalVersion) : executingSkill;
      skillsToExecute.push({ skillInfo: followingSkillData, firstMessage: "装備品の効果により", lastMessage: `${executingSkill.name}を もう一度はなった！` });
    }
    // 条件付き追加特技: 状態異常でも発動(可能性あり)・体技封じ有効  双璧の幻獣・改 悪魔衆の踊り 体技攻撃でなめまわし 教団の光 HP半分ではやての息吹 うさぎドロップキック
    const targetAbility = skillUser.abilities.followingAbilities;
    // 各種availableIf内でexecutingSkill.typeがnotskill以外の場合のみ発動するよう指定、通常攻撃で追加特技が発動しないようにしている
    if (targetAbility && targetAbility.availableIf(skillUser, executingSkill)) {
      // executingSkillを渡してskillNameを返り値でもらう
      const skillName = targetAbility.getFollowingSkillName(executingSkill);
      skillsToExecute.push({ skillInfo: findSkillByName(skillName), firstMessage: `${skillUser.name}の特性により`, lastMessage: `${skillName} が発動！` });
    }
    // 直接指定する追加特技: 同上 王のつるぎ
    if (
      skillUser.buffs.pharaohPower &&
      parties[skillUser.teamID].some((monster) => monster.name === "ファラオ・カーメン") &&
      executingSkill.type !== "notskill" && // notskill以外であることを直接指定
      executedSkills.some((skill) => isDamageExistingSkill(skill) && skill.targetTeam === "enemy")
    ) {
      skillsToExecute.push({ skillInfo: findSkillByName("ファラオの幻刃"), firstMessage: `${skillUser.name}は`, lastMessage: "ファラオの幻刃 をはなった！" });
    }

    for (const skill of skillsToExecute) {
      const { skillInfo, firstMessage, lastMessage } = skill;
      await sleep(250);
      displayMessage(firstMessage, lastMessage);
      await sleep(400);
      col(`${skillUser.name}が追加特技を実行: ${skillInfo.name}`);
      // skill実行 非反撃・連携対象なので damagedMonstersとisProcess, isAIはnullまたはfalse
      await executeSkill(skillUser, skillInfo, null, false, null, false, false, null);
      await sleep(200);
      // skill実行完了のたびに確認
      if (isBattleOver()) {
        return; // 毒や継続を実行せず即時return
      } else if (skipThisMonsterAction(skillUser)) {
        break; // skip状態の場合は毒や継続を続けて実行
      }
    }
  }

  // 7-5. 行動後発動特性の処理 //executingSkillがnullの場合に要注意
  async function executeAfterActionAbilities(monster) {
    const abilitiesToExecute = [];
    // 各ability配列の中身を展開して追加
    abilitiesToExecute.push(...(monster.abilities.afterActionAbilities ?? []));
    abilitiesToExecute.push(...(monster.abilities.additionalAfterActionAbilities ?? []));
    for (const ability of abilitiesToExecute) {
      // oneTimeUseで実行済 または発動不可能条件に当てはまった場合次のabilityへ
      if (monster.flags.executedAbilities.includes(ability.name) || (ability.unavailableIf && ability.unavailableIf(monster, executingSkill, executedSkills))) {
        continue;
      }
      await sleep(300);
      if (!ability.disableMessage) {
        if (ability.hasOwnProperty("message")) {
          ability.message(monster);
          await sleep(300);
        } else if (ability.hasOwnProperty("name")) {
          displayMessage(`${monster.name}の特性 ${ability.name}が発動！`);
          await sleep(300);
        }
      }
      //実行済skillを渡して実行 最初の要素が選択したskill
      await ability.act(monster, executingSkill, executedSkills);
      //実行後の記録
      if (ability.isOneTimeUse) {
        monster.flags.executedAbilities.push(ability.name);
      }
      await sleep(200);
    }
  }
  if (skillUser.commandInput !== "skipThisTurn") {
    await executeAfterActionAbilities(skillUser);
  }

  // 7-6. 属性断罪の刻印処理
  if (
    skillUser.commandInput !== "skipThisTurn" &&
    skillUser.buffs.elementalRetributionMark &&
    executedSkills &&
    executedSkills.some((skill) => skill.element !== "none" && skill.type !== "notskill")
  ) {
    await applyDotDamage(skillUser, 0.7, "ダメージをうけた！", true);
  }
  if (isBattleOver()) return; // 処理全体の実行前に戦闘終了check 毒や継続を実行せず即時return

  // 7-7. 自動HPMP回復
  async function executeAfterActionHealAbilities(monster) {
    const abilitiesToExecute = [];
    // 各ability配列の中身を展開して追加
    abilitiesToExecute.push(...(monster.abilities.afterActionHealAbilities ?? []));
    abilitiesToExecute.push(...(monster.abilities.additionalAfterActionHealAbilities ?? []));
    for (const ability of abilitiesToExecute) {
      // 発動不可能条件に当てはまった場合次のabilityへ
      if (ability.unavailableIf && ability.unavailableIf(monster)) {
        continue;
      }
      await sleep(200);
      await ability.act(monster);
      await sleep(200);
    }
    if (monster.buffs.continuousMPHealing) {
      await sleep(300);
      let healAmount = 50;
      if (monster.buffs.continuousMPHealing.strength) {
        healAmount = monster.buffs.continuousMPHealing.strength * monster.defaultStatus.HP;
      }
      applyHeal(monster, healAmount, true);
      await sleep(200);
    }
  }
  if (skillUser.commandInput !== "skipThisTurn") {
    await executeAfterActionHealAbilities(skillUser);
  }

  // 7-8. 特殊追加skillの実行 (ナドラガ竜の心臓による同じ特技追撃)
  if (!isBattleOver() && !skipThisMonsterAction(skillUser) && skillUser.commandInput !== "skipThisTurn" && domainCheck) {
    await sleep(150);
    displayMessage("竜の心臓の効果により", `もう一度 ${executingSkill.name}を はなった！`);
    await sleep(300);
    await executeSkill(skillUser, executingSkill);
  }

  // 7-9. 毒処理
  if (isBattleOver()) return; // 処理全体の実行前に戦闘終了check 毒や継続を実行せず即時return
  if (skillUser.commandInput !== "skipThisTurn" && skillUser.buffs.poisoned) {
    const baseRatio = skillUser.buffs.poisoned.isLight ? 0.0625 : 0.125;
    const poisonMessage = skillUser.buffs.poisoned.isLight ? "どくにおかされている！" : "もうどくにおかされている！";
    const poisonDepth = skillUser.buffs.poisonDepth?.strength ?? 1;
    await applyDotDamage(skillUser, baseRatio * poisonDepth, poisonMessage);
  }
  // 7-10. 継続ダメージ処理
  if (isBattleOver()) return; // 処理全体の実行前に戦闘終了check 毒や継続を実行せず即時return
  if (skillUser.commandInput !== "skipThisTurn" && skillUser.buffs.dotDamage) {
    await applyDotDamage(skillUser, skillUser.buffs.dotDamage.strength, "HPダメージを受けている！");
  }
  // 7-11. 継続MPダメージ処理
  if (isBattleOver()) return; // 処理全体の実行前に戦闘終了check 毒や継続を実行せず即時return
  if (skillUser.commandInput !== "skipThisTurn" && skillUser.buffs.dotMPdamage) {
    await sleep(400);
    const dotDamageValue = skillUser.buffs.dotMPdamage.strength;
    displayMessage(`${skillUser.name}は`, "MPダメージを受けている！");
    await sleep(200);
    applyDamage(skillUser, dotDamageValue, 1, true);
  }
  // 7-12. MP吸収処理(wip)
  if (skillUser.commandInput !== "skipThisTurn" && skillUser.buffs.MPabsorption) {
    await sleep(400);
    const dotDamageValue = skillUser.buffs.MPabsorption.strength;
    displayMessage(`${skillUser.name}は`, "MPを吸収された！");
    await sleep(200);
    applyDamage(skillUser, dotDamageValue, 1, true);
  }
  // 刻印・毒・継続の共通処理
  async function applyDotDamage(skillUser, damageRatio, message, isRetribution = false) {
    if (skillUser.commandInput === "skipThisTurn") return;
    await sleep(400);
    let dotDamageValue = Math.floor(skillUser.defaultStatus.HP * damageRatio);
    // damage上限
    if (skillUser.buffs.damageLimit && dotDamageValue > skillUser.buffs.damageLimit.strength) {
      dotDamageValue = skillUser.buffs.damageLimit.strength;
    }
    const firstMessage = isRetribution ? `${skillUser.name}は 刻印の効果で` : `${skillUser.name}は`;
    displayMessage(firstMessage, `${message}`);
    col(`${firstMessage}${message}${dotDamageValue}ダメージ`);
    await sleep(200);
    applyDamage(skillUser, dotDamageValue, 1, false, false, false, true, null); // skipDeathAbility
    // recentlyKilledを回収して死亡時発動を実行
    await checkRecentlyKilledFlagForPoison(skillUser);
  }

  // 7-13. 被ダメージ時発動skill処理 反撃はリザオ等で蘇生しても発動するし、反射や死亡時で死んでも他に飛んでいくので制限はなし
  for (const monster of parties[skillUser.enemyTeamID]) {
    if (!isBattleOver() && damagedMonsters.includes(monster.monsterId)) {
      await executeCounterAbilities(monster);
    }
  }
  // 優先度: 装備 特性 特技の順で一つだけ実行 counter本体: 特性を初期値として装備存在時は関数内で上書き additional: 特技を一時的に格納
  async function executeCounterAbilities(monster) {
    // 反撃者が死亡時はまたは亡者は反撃しない リザオなどで蘇生してたら反撃  被反撃者の生死は考慮しない(リザオ等で蘇生しても発動,反射や死亡時で死んでも他に飛んでいくので制限なし)
    if (monster.flags.isDead || monster.flags.isZombie) {
      return;
    }
    await sleep(300);
    const abilitiesToExecute = [];
    // 各ability配列の中身を展開して追加
    abilitiesToExecute.push(...(monster.abilities.counterAbilities ?? []));
    abilitiesToExecute.push(...(monster.abilities.additionalCounterAbilities ?? []));
    for (const ability of abilitiesToExecute) {
      // oneTimeUseで実行済 または発動不可能条件に当てはまった場合次のabilityへ
      if (monster.flags.executedAbilities.includes(ability.name) || (ability.unavailableIf && ability.unavailableIf(monster))) {
        continue;
      }
      await sleep(300);
      if (!ability.disableMessage) {
        if (ability.hasOwnProperty("message")) {
          ability.message(monster);
          await sleep(300);
        } else if (ability.hasOwnProperty("name")) {
          displayMessage(`${monster.name}の特性 ${ability.name}が発動！`);
          await sleep(300);
        }
      }
      //実行済skillを渡して実行 最初の要素が選択したskill  反撃先としてskillUserを渡す
      await ability.act(monster, skillUser);
      //実行後の記録
      if (ability.isOneTimeUse) {
        monster.flags.executedAbilities.push(ability.name);
      }
      await sleep(200); //多め
      return; // 1つだけ実行
    }
  }
}

function decideAICommandShowNoMercy(skillUser) {
  const availableSkills = [];
  const validTargets = parties[skillUser.enemyTeamID].filter((monster) => !monster.flags.isDead);
  if (validTargets.length === 0) {
    return [null, null];
  } else {
    validTargets.sort((a, b) => {
      const ratioA = a.currentStatus.HP / a.defaultStatus.HP;
      const ratioB = b.currentStatus.HP / b.defaultStatus.HP;
      return ratioA === ratioB ? a.currentStatus.HP - b.currentStatus.HP : ratioA - ratioB;
    });
  }

  for (const skillName of skillUser.skill) {
    const skillInfo = findSkillByName(skillName);

    if (
      !skillUser.availableSkillsOnAIthisTurn.includes(skillName) ||
      isSkillUnavailableForAI(skillName) ||
      (skillUser.buffs[skillInfo.type + "Seal"] && !skillInfo.skipSkillSealCheck) ||
      skillUser.flags.unavailableSkills.includes(skillName) ||
      skillUser.disabledSkillsByPlayer.includes(skillName) ||
      !hasEnoughMpForSkill(skillUser, skillInfo) ||
      skillInfo.howToCalculate === "none" ||
      skillInfo.targetTeam !== "enemy"
    ) {
      continue;
    }

    let killableCount = 0;
    let totalDamage = 0;
    let target = null;
    let skipSkill = false; // Flag to skip the current skill

    // allの場合 killableCountとtotalDamageは累計 targetは未指定
    if (skillInfo.targetType === "all") {
      for (const target of validTargets) {
        const resistance = calculateResistance(skillUser, skillInfo.element, target, fieldState.isDistorted, skillInfo);
        // ひとつでも吸収反射ならばbreak後に次skillにcontinue
        if (resistance < 0 || isSkillReflected(skillInfo, target)) {
          skipSkill = true;
          break;
        }
        const { damage: damagePerHit } = calculateDamage(skillUser, skillUser, skillInfo, target, resistance, true, true, false, null, 1, null);
        const damage = damagePerHit * (skillInfo.hitNum || 1);
        totalDamage += damage;
        if (damage >= target.currentStatus.HP) {
          killableCount++;
        }
      }
    } else {
      // single randomの場合 killableCountとtotalDamageは個別 target指定
      let bestTargetDamage = 0;
      for (const potentialTarget of validTargets) {
        const resistance = calculateResistance(skillUser, skillInfo.element, potentialTarget, fieldState.isDistorted, skillInfo);
        if (resistance < 0 || isSkillReflected(skillInfo, potentialTarget)) {
          // randomの場合、ひとつでも吸収反射ならばbreak後に次skillにcontinue
          if (skillInfo.targetType === "random") {
            skipSkill = true;
            break;
          }
          continue;
        }
        // 倒せる敵を最終決定済の場合、反射吸収判定だけループを継続してランダム特技の使用禁止条件をcheck
        if (killableCount === 1) {
          continue;
        }
        const { damage: damagePerHit } = calculateDamage(skillUser, skillUser, skillInfo, potentialTarget, resistance, true, true, false, null, 1, null);
        const damage = damagePerHit * (skillInfo.hitNum || 1);

        // 倒せる場合 既にHP低い順にsortされているので、このpotentialTargetに最終決定 ただしランダム特技の反射吸収防止のため、breakはせず反射吸収判定のみ継続
        if (damage >= potentialTarget.currentStatus.HP) {
          killableCount = 1;
          totalDamage = damage; // killableCountは最大で1 totalDamageは個別
          target = potentialTarget;
        } else if (damage > bestTargetDamage) {
          // 倒せない場合 これまでのbestTargetDamageより大きければ更新して次の判定へ 初回は0なのでダメージが通りさえすれば確定更新
          bestTargetDamage = damage;
          totalDamage = bestTargetDamage;
          target = potentialTarget;
        }
      }

      // singleで、もし全てのpotentialTargetに対して反射吸収によるcontinueし続けたならば
      if (!target) {
        skipSkill = true;
      }
    }

    // 次skillに移行
    if (skipSkill) continue;
    // 全ての相手にダメージが通らない場合 (allの累計が0 または single randomで個別の相手に対するdamageが全ての0) 通常攻撃のほうがダメージが出るのでcontinue
    if (killableCount === 0 && totalDamage === 0) continue;

    availableSkills.push({
      skillInfo,
      killableCount,
      totalDamage,
      target,
    });
  }

  availableSkills.sort((a, b) => {
    if (a.killableCount !== b.killableCount) {
      return b.killableCount - a.killableCount;
    } else {
      return b.totalDamage - a.totalDamage;
    }
  });

  if (availableSkills.length > 0) {
    const bestSkill = availableSkills[0];
    return [bestSkill.skillInfo, bestSkill.target];
  } else {
    // 全部ダメなら通常攻撃
    return decideAICommandNoSkillUse(skillUser);
  }
}

function decideAICommandFocusOnHeal(skillUser) {
  let executingSkill = null;
  const availableReviveSkills = [];
  const availableAllHealSkills = [];
  const availableSingleHealSkills = [];
  for (const skillName of skillUser.skill) {
    const skillInfo = findSkillByName(skillName);
    // 除外条件のいずれかを満たすとき次へ送る 蘇生か回復技のみに選定
    if (
      !skillUser.availableSkillsOnAIthisTurn.includes(skillName) ||
      isSkillUnavailableForAI(skillName) ||
      (skillUser.buffs[skillInfo.type + "Seal"] && !skillInfo.skipSkillSealCheck) ||
      skillUser.flags.unavailableSkills.includes(skillName) ||
      skillUser.disabledSkillsByPlayer.includes(skillName) ||
      // unavailableIfは様子見
      !hasEnoughMpForSkill(skillUser, skillInfo)
    ) {
      continue;
    }
    // 分けて格納
    if (skillInfo.targetType === "dead") {
      availableReviveSkills.push(skillInfo);
    } else if (skillInfo.isHealSkill && skillInfo.targetType === "all") {
      availableAllHealSkills.push(skillInfo);
    } else if (skillInfo.isHealSkill) {
      availableSingleHealSkills.push(skillInfo); //randomも可能性はある
    }
  }
  // 蘇生技所持時 かつ 蘇生target存在時に蘇生を指定
  if (availableReviveSkills.length > 0) {
    const validTargets = parties[skillUser.teamID].filter((monster) => monster.flags.isDead && !monster.flags.isZombie && !monster.buffs.reviveBlock);
    let fastestTarget = null;
    // validTargetsが存在するとき、targetを決定してそこに蘇生技を打ってreturn
    if (validTargets.length > 0) {
      fastestTarget = validTargets[0];
      for (let i = 1; i < validTargets.length; i++) {
        // ランクが高い または 同ランクかつ素早さが高い場合更新
        if (validTargets[i].rank > fastestTarget.rank) {
          fastestTarget = validTargets[i];
        } else if (validTargets[i].rank === fastestTarget.rank && validTargets[i].modifiedSpeed > fastestTarget.modifiedSpeed) {
          fastestTarget = validTargets[i];
        }
      }
      // 決定したtargetに蘇生技を撃つ commandInputはそのまま
      executingSkill = availableReviveSkills[0];
      return [executingSkill, fastestTarget];
    }
  }
  // 蘇生技未所持 または 有効なtargetがいなかった場合
  const validHealTargets = parties[skillUser.teamID].filter((monster) => !monster.flags.isDead && !monster.flags.isZombie && monster.currentStatus.HP !== monster.defaultStatus.HP);
  // 回復可能な味方がいる場合は回復技を撃つ
  if (validHealTargets.length > 0) {
    // 全体回復技所持時はそれを選んでreturn
    if (availableAllHealSkills.length > 0) {
      executingSkill = availableAllHealSkills[0];
      return [executingSkill, null];
    }
    // 単体乱打回復技所持時
    if (availableSingleHealSkills.length > 0) {
      let lowestTarget = null;
      lowestTarget = validHealTargets[0];
      for (let i = 1; i < validHealTargets.length; i++) {
        const currentTarget = validHealTargets[i];
        // 最低値のmonsterに更新
        if (currentTarget.currentStatus.HP / currentTarget.defaultStatus.HP < lowestTarget.currentStatus.HP / lowestTarget.defaultStatus.HP) {
          lowestTarget = currentTarget;
        }
      }
      // 決定したtargetに回復技を撃つ commandInputはそのまま
      executingSkill = availableSingleHealSkills[0];
      return [executingSkill, lowestTarget];
    }
  }
  // 全部ダメなら通常攻撃
  return decideAICommandNoSkillUse(skillUser);
}

// とくぎつかうな
function decideAICommandNoSkillUse(skillUser) {
  let executingSkill;
  let targetMonster = decideNormalAttackTarget(skillUser);
  // 反射持ちをなるべく選択しないようにして選出された返り値さえ反射持ち(つまり全員反射持ち)の場合、防御に設定
  if (targetMonster && targetMonster.buffs.slashReflection && targetMonster.buffs.slashReflection.isKanta) {
    executingSkill = findSkillByName("ぼうぎょ");
    targetMonster = null;
  } else {
    // それ以外の場合は通常攻撃を選択 targetはそのまま
    executingSkill = findSkillByName(getNormalAttackName(skillUser));
  }
  return [executingSkill, targetMonster];
}

function getMonsterAiCommand(skillUser) {
  if (skillUser.currentAiType === "いのちだいじに") {
    return decideAICommandFocusOnHeal(skillUser);
  } else if (skillUser.currentAiType === "ガンガンいこうぜ") {
    return decideAICommandShowNoMercy(skillUser);
  } else if (skillUser.currentAiType === "とくぎつかうな") {
    return decideAICommandNoSkillUse(skillUser);
  }
}

// カウントダウン・刻印・毒・継続で死亡時に、recentlyKilledを回収して死亡時発動を実行する
async function checkRecentlyKilledFlagForPoison(monster) {
  if (monster.flags.recentlyKilled) {
    delete monster.flags.recentlyKilled;
    const excludedTargets = new Set();
    excludedTargets.add(monster);
    await processDeathAction(monster, excludedTargets);
  }
}

// 死亡判定を行う関数
function isDead(monster) {
  return monster.flags.isDead === true;
}

// 状態異常判定を行う関数
function hasAbnormality(monster) {
  const abnormalityMessages = {
    stoned: "鉄のようになり みがまえている！",
    paralyzed: "からだがしびれて動けない！",
    asleep: "ねむっている！",
    confused: "こんらんしている！",
    fear: "動きを ふうじられている！",
    tempted: "動きを ふうじられている！",
    sealed: "動きを ふうじられている！",
    boogieCurseSubstituting: "動きを ふうじられている！",
  };

  for (const key in abnormalityMessages) {
    if (monster.buffs[key]) {
      return abnormalityMessages[key];
    }
  }
  return false;
}

//吸収以外の錬金が乗る回復
function applyHeal(target, healAmount, isMPheal = false, ignoreHealBoost = false) {
  let calculatedHealAmount = healAmount;
  if (!ignoreHealBoost && target.gear && target.gear.healBoost) {
    calculatedHealAmount *= target.gear.healBoost;
  }
  applyDamage(target, calculatedHealAmount, -1, isMPheal);
}

// ダメージを適用する関数
function applyDamage(target, damage, resistance = 1, isMPdamage = false, reducedByElementalShield = false, isCriticalHit = false, skipDeathAbility = false, perpetrator = null) {
  if (resistance === -1) {
    // 死者は終了
    if (target.flags.isDead) {
      return;
    }
    // 亡者はミス表示して終了
    if (target.flags.isZombie) {
      displayMiss(target);
      return;
    }
    // 回復処理 基礎値を用意
    let healAmount = Math.floor(Math.abs(damage)); // 小数点以下切り捨て＆絶対値
    // 回復封じ処理
    if (target.buffs.healBlock || target.buffs.specialHealBlock) {
      displayDamage(target, 0, -1, isMPdamage);
      return;
    }
    if (isMPdamage) {
      // MP回復
      healAmount = Math.min(healAmount, target.defaultStatus.MP - target.currentStatus.MP);
      target.currentStatus.MP += healAmount;
      console.log(`${target.name}のMPが${healAmount}回復！`);
      displayMessage(`${target.name}の`, `MPが ${healAmount}回復した！`);
      displayDamage(target, -healAmount, -1, true); // MP回復は負の数で表示
    } else {
      // HP回復
      healAmount = Math.min(healAmount, target.defaultStatus.HP - target.currentStatus.HP);
      target.currentStatus.HP += healAmount;
      console.log(`${target.name}のHPが${healAmount}回復！`);
      displayMessage(`${target.name}の`, `HPが ${healAmount}回復した！`);
      displayDamage(target, -healAmount, -1); // HP回復は負の数で表示
    }

    updateMonsterBar(target);
    return;
  } else {
    // ダメージ処理
    if (isMPdamage) {
      // MP 死者は終了
      if (target.flags.isDead) {
        return;
      }
      // MP 亡者には実行
      // MPダメージ 現状値が最大ダメージ
      let mpDamage = Math.min(target.currentStatus.MP, Math.floor(damage));
      target.currentStatus.MP -= mpDamage;
      console.log(`${target.name}に${mpDamage}のMPダメージ！`);
      displayMessage(`${target.name}の`, "MPが さがった！");
      // displayMessage(`${target.name}は MPダメージを受けている！`); 継続MPダメージ
      displayDamage(target, mpDamage, resistance, true);
      updateMonsterBar(target);
      return;
    } else {
      // HPダメージ 表示はオーバーフロー可
      const hpDamage = Math.floor(damage); // 小数点以下切り捨て
      target.currentStatus.HP = Math.max(target.currentStatus.HP - hpDamage, 0);
      console.log(`${target.name}に${hpDamage}のダメージ！`);
      if (hpDamage === 0 && !reducedByElementalShield) {
        displayMessage(`ミス！ダメージをあたえられない！`);
      } else {
        displayMessage(`${target.name}に`, `${hpDamage}のダメージ！！`);
      }
      // HPかつダメージのときのみ、reducedByElementalShieldを渡して0ダメ表示対応 会心フラグも渡す
      displayDamage(target, hpDamage, resistance, false, reducedByElementalShield, isCriticalHit);

      // 亡者はダメージ表示(と無意味なcurrentの更新)のみ updateMonsterBarやくじけぬは実行せず終了
      if (target.flags.isZombie) {
        return;
      }
      //updateMonsterBarはくじけぬ未所持判定後か、くじけぬ処理の分岐内で実行
      if (target.currentStatus.HP === 0 && !target.flags.isDead) {
        // くじけぬ処理
        if (target.buffs.isUnbreakable) {
          if (target.buffs.isUnbreakable.isToukon) {
            if (Math.random() < 0.75) {
              target.buffs.isUnbreakable.left--;
              handleUnbreakable(target);
              //とうこんの場合のみ、確定枠を消費したら削除
              if (target.buffs.isUnbreakable.left <= 0) {
                delete target.buffs.isUnbreakable;
              }
            } else {
              handleDeath(target, false, skipDeathAbility, perpetrator);
            }
          } else {
            if (target.buffs.isUnbreakable.left > 0 && !target.buffs.revive) {
              //確定枠がありかつリザオがない場合、確定枠を消費して耐える
              target.buffs.isUnbreakable.left--;
              handleUnbreakable(target);
            } else {
              //確定枠がないまたはリザオありの場合、確定枠は無視
              if (Math.random() < 0.75) {
                handleUnbreakable(target);
              } else {
                handleDeath(target, false, skipDeathAbility, perpetrator);
              }
            }
          }
        } else {
          // くじけぬなしは確定死亡
          handleDeath(target, false, skipDeathAbility, perpetrator);
        }
      } else {
        updateMonsterBar(target, true); //赤いバー表示
        return;
      }
    }
  }
}

function handleUnbreakable(target) {
  target.currentStatus.HP = 1;
  updateMonsterBar(target, true); //赤いバー表示
  console.log(`${target.name}の特性、${target.buffs.isUnbreakable.name}が発動！`);
  displayMessage(`${target.name}の特性 ${target.buffs.isUnbreakable.name}が発動！`);
  if (target.buffs.isUnbreakable.left > 0) {
    console.log(`残り${target.buffs.isUnbreakable.left}回`);
    displayMessage(`残り${target.buffs.isUnbreakable.left}回`);
  }
}

function handleDeath(target, hideDeathMessage = false, applySkipDeathAbility = false, perpetrator = null, isCountDown = false) {
  if (target.flags.isZombie) {
    return;
  }
  target.currentStatus.HP = 0;
  target.flags.isDead = true;
  target.flags.recentlyKilled = true;
  target.flags.beforeDeathActionCheck = true;
  delete target.flags.guard;
  delete target.flags.hazamaNeverKilled;
  // 毒 供物 反射でskipDeathAbilityが渡された場合、processDeathAction内で死亡時発動を実行しないマーカーを付与
  if (applySkipDeathAbility) {
    target.flags.skipDeathAbility = true;
  }
  // 加害者が存在して敵teamの場合のみ記録 handleDeath実行のたびに更新
  const validPerpetrator = perpetrator && target.teamID !== perpetrator.teamID ? perpetrator : null;
  target.flags.perpetrator = validPerpetrator;

  // 死亡時のバフを記録 都度更新
  target.flags.buffKeysOnDeath = Object.keys(target.buffs);

  delete target.buffs.countDown;

  ++fieldState.deathCount[target.teamID];
  // タッグおよびリザオ蘇生予定がない場合、完全死亡カウントを増加
  if (!target.buffs.tagTransformation && !(target.buffs.revive && !target.buffs.reviveBlock)) {
    ++fieldState.completeDeathCount[target.teamID];
    // 支配持ちが蘇生予定なしで完全死亡した場合、rapu変身フラグを立てる
    if (target.buffs.controlOfRapu) {
      const enemyRapus = parties[target.enemyTeamID].filter((member) => member.name === "新たなる神ラプソーン");
      for (const eachRapu of enemyRapus) {
        eachRapu.flags.rapuTransformTurn = fieldState.turnNum + 1;
      }
    }
  }
  console.log(`party${target.teamID}の${target.name}の死亡でカウントが${fieldState.deathCount[target.teamID]}になった`);

  //供物を戻す
  if (target.skill[3] === "供物をささげる") {
    target.skill[3] = target.defaultSkill[3];
  }

  deleteSubstitute(target);

  // リザオ蘇生もtag変化もリザオ蘇生もしない かつ亡者化予定の場合flagを付与 applySkipDeathAbilityがtrue指定(毒 供物 反射)の場合は亡者化しない
  if (
    !target.buffs.tagTransformation &&
    !(target.buffs.revive && !target.buffs.reviveBlock) &&
    (!target.buffs.zombifyBlock || target.flags.isUnAscensionable) &&
    (!applySkipDeathAbility || isCountDown || target.name === "非道兵器超魔ゾンビ" || target.name === "万物の王オルゴ・デミーラ") &&
    (target.buffs.zombification || (target.flags.zombieProbability && Math.random() < target.flags.zombieProbability))
  ) {
    target.flags.willZombify = true;
  }

  // 蘇生封じ tag変身時は削除 それ以外はpropertyを削除して永久確定化(ただし光の波動解除可能は残すため、亡者化中の光の波動や死者の解放は有効)
  if (target.buffs.reviveBlock && !target.buffs.reviveBlock.unDispellableByRadiantWave) {
    if (target.buffs.tagTransformation) {
      delete target.buffs.reviveBlock;
    } else {
      // nameは残し、亡者化予定の場合に鎮魂を解除する
      delete target.buffs.reviveBlock.duration;
      delete target.buffs.reviveBlock.decreaseTurnEnd;
      delete target.buffs.reviveBlock.removeAtTurnStart;
    }
  }

  // tag変化もゾンビ化もしない場合のみ、コマンドスキップ
  if (!target.buffs.tagTransformation && !target.flags.willZombify) {
    target.commandInput = "skipThisTurn";
    //次のhitSequenceも実行しない
  }

  // tag変化・リザオ・ゾンビ化・供物による(リザオ所持・未所持にかかわらず)確定蘇生など、当該monsterが蘇生系により戦闘継続する場合、戦闘継続判定のためのflagを付与
  // 供物は既に付与済 それぞれの実行直前に削除
  if (target.buffs.tagTransformation || (target.buffs.revive && !target.buffs.reviveBlock) || target.flags.willZombify) {
    target.flags.waitingForRevive = true;
  }
  // 戦闘終了判定 flag所持時は継続と判定する 超魔ゾンビ自傷によるhandleDeath実行後によって戦闘終了しないようここでは実行しない
  // updateIsBattleOver();

  // keepOnDeathを持たないバフと異常を削除 (zombifyBlockの消滅を防ぐため亡者判定後に)
  const newBuffs = {};
  for (const buffKey in target.buffs) {
    if (target.buffs[buffKey].keepOnDeath) {
      newBuffs[buffKey] = target.buffs[buffKey];
    }
  }
  target.buffs = newBuffs;

  updateMonsterBar(target, true); //isDead付与後にupdateでbar非表示化
  updateBattleIcons(target);
  updateCurrentStatus(target);
  // TODO:仮置き ここで明示的に buffContainer を削除する
  let wrapper = document.getElementById(target.iconElementId).parentElement;
  const buffContainer = wrapper.querySelector(".buffContainer");
  if (buffContainer) {
    buffContainer.remove();
  }
  updateMonsterBuffsDisplay(target);
  document.getElementById(target.iconElementId).parentNode.classList.remove("stickOut");
  document.getElementById(target.iconElementId).parentNode.classList.remove("recede");
  if (!hideDeathMessage) {
    if (target.teamID === 0) {
      console.log(`${target.name}はちからつきた！`);
      displayMessage(`${target.name}は ちからつきた！`);
    } else {
      console.log(`${target.name}をたおした！`);
      displayMessage(`${target.name}を たおした！`);
    }
  }
}

async function executeSkill(
  skillUser,
  executingSkill,
  assignedTarget = null,
  isProcessMonsterAction = false,
  damagedMonsters = null,
  isAIattack = false,
  ignoreAbnormalityCheck = false,
  MPusedParameter = null
) {
  let currentSkill = executingSkill;
  let isMonsterAction = isProcessMonsterAction;
  // 実行済skillを格納
  let executedSkills = [];
  let isFollowingSkill = false;
  let executedSingleSkillTarget = [];
  let MPused = MPusedParameter;
  // このターンに死んでない場合常に実行 死亡時能力は常に実行 反撃で死んでない このいずれかを満たす場合に実行
  while (
    currentSkill &&
    (skillUser.commandInput !== "skipThisTurn" || currentSkill.skipDeathCheck || (currentSkill.isCounterSkill && !skillUser.flags.isDead)) &&
    (currentSkill.skipAbnormalityCheck || ignoreAbnormalityCheck || !hasAbnormality(skillUser))
  ) {
    // 6. スキル実行処理
    // 戦闘終了またはskip時は特に表示せず即時return ただしisBattleOverでも、敵が生存していて起爆装置等ならば実行する
    const deathSkills = ["起爆装置", "トラウマトラップ爆発"];
    if (isAllEnemyDead(skillUser) || skipThisMonsterAction(skillUser) || (isBattleOver() && !deathSkills.includes(currentSkill.name))) {
      break;
    }
    // executedSingleSkillTargetの中身=親skillの最終的なskillTargetがisDeadで、かつsingleのfollowingSkillならばreturn
    if (isFollowingSkill && currentSkill.targetType === "single" && executedSingleSkillTarget.length > 0 && executedSingleSkillTarget[0].flags.isDead) {
      break;
    }

    // skill変更条件を確認
    if (currentSkill.reviseIf && currentSkill.reviseIf(skillUser)) {
      currentSkill = findSkillByName(currentSkill.reviseIf(skillUser));
    }

    // 実行済みスキルを配列末尾に追加
    executedSkills.push(currentSkill);

    // スキル実行中に死亡したモンスターを追跡 (skill開始時に既に死亡しているものは含めず、純粋に倒した敵を記録)
    const killedByThisSkill = new Set();
    // スキル実行中に死亡したモンスターを追跡 (skill開始時に既に死亡しているものも含め、skillTargetから外す)
    const excludedTargets = new Set();
    for (const party of parties) {
      for (const monster of party) {
        if (monster.flags.isDead) {
          excludedTargets.add(monster);
        }
      }
    }

    let skillTarget = assignedTarget;
    // followingSkillのtargetをnull化してランダムにする(暫定的) クアトロのみ random特技(イフシバ)はAI追撃後に移行
    if (isFollowingSkill && (currentSkill.targetType === "random" || currentSkill.howToCalculate === "MP")) {
      skillTarget = null;
    }

    // ヒット処理の実行
    console.log(`${skillUser.name}が${currentSkill.name}を実行`);
    await processHitSequence(skillUser, currentSkill, skillTarget, excludedTargets, killedByThisSkill, 0, null, executedSingleSkillTarget, isMonsterAction, damagedMonsters, isAIattack, MPused);

    // currentSkill実行後、生存にかかわらず実行するact 行動skip判定前に実行
    if (currentSkill.afterActionAct) {
      await currentSkill.afterActionAct(skillUser);
    }

    // afterActionAct実行後に全滅判定 全滅時も実行する起爆装置等はfollowingがないのでこのままでOK
    if (isBattleOver()) {
      break; // 全滅時は即時にwhile文ごとbreakしてexecutedSkillsを返す selfApplieEffectやfollowingは実行しない
    } else if (skipThisMonsterAction(skillUser)) {
      // skip時はフラグを立て、selfAppliedEffectは実行せず、followingSkill存在時はようす表示だけしてbreak
    } else {
      //currentSkill実行後、生存している場合はselfAppliedEffect付与 戦闘継続時のみ実行
      if (currentSkill.selfAppliedEffect && (skillUser.commandInput !== "skipThisTurn" || currentSkill.skipDeathCheck || (currentSkill.isCounterSkill && !skillUser.flags.isDead))) {
        await currentSkill.selfAppliedEffect(skillUser);
      }
    }

    // followingSkillが存在する場合、次のスキルを代入してループ
    if (currentSkill.followingSkill) {
      await sleep(350);
      if (skipThisMonsterAction(skillUser)) {
        waitingMessage(skillUser);
        break;
      }
      currentSkill = findSkillByName(currentSkill.followingSkill);
      isFollowingSkill = true;
      // クアトロ用 初撃のMPusedを引き継ぎ続けないようnull化 反撃対象から外す 双撃等のtarget固定を外す target本体のランダム化はrandom特技のfollowingと同時に
      if (currentSkill.howToCalculate === "MP") {
        MPused = null;
        isMonsterAction = false;
        executedSingleSkillTarget = [];
      }
    } else {
      break;
    }
  }
  return executedSkills;
}

// ヒットシーケンスを処理する関数
async function processHitSequence(
  skillUser,
  executingSkill,
  assignedTarget,
  excludedTargets,
  killedByThisSkill,
  currentHit,
  singleSkillTarget = null,
  executedSingleSkillTarget = null,
  isProcessMonsterAction = false,
  damagedMonsters = null,
  isAIattack = false,
  MPused
) {
  if (currentHit >= (executingSkill.hitNum ?? 1)) {
    return; // ヒット数が上限に達したら終了
  }
  const deathSkills = ["起爆装置", "トラウマトラップ爆発"];
  // 戦闘終了時のみ即時return skip判定はしない
  if (isAllEnemyDead(skillUser) || (isBattleOver() && !deathSkills.includes(executingSkill.name))) {
    return;
  }
  //毎回deathActionはしているので、停止時はreturnかけてOK
  //停止条件: all: aliveが空、random: determineの返り値がnull、single: 敵が一度でも死亡
  //hitSequenceごとに、途中で死亡時発動によってskillUserが死亡していたらreturnする
  if (!(skillUser.commandInput !== "skipThisTurn" || executingSkill.skipDeathCheck || (executingSkill.isCounterSkill && !skillUser.flags.isDead))) {
    return;
  }

  let skillTarget;

  // ターゲットタイプに応じたターゲット決定処理
  switch (executingSkill.targetType) {
    case "all":
      // 全体攻撃
      // 生きているモンスターかつexcludedTargets対象外をtargetとする
      const aliveMonsters = (executingSkill.targetTeam === "ally" ? parties[skillUser.teamID] : parties[skillUser.enemyTeamID]).filter(
        (monster) => !monster.flags.isDead && !excludedTargets.has(monster)
      );
      if (aliveMonsters.length === 0) {
        return;
      }
      for (const target of aliveMonsters) {
        let eachTarget = target;
        // みがわり処理 味方補助でないかつみがわり無視でないときに変更
        if (eachTarget.flags.hasSubstitute && !executingSkill.ignoreSubstitute && !(executingSkill.howToCalculate === "none" && executingSkill.targetTeam === "ally")) {
          eachTarget = parties.flat().find((monster) => monster.monsterId === eachTarget.flags.hasSubstitute.targetMonsterId);
        }
        await processHit(skillUser, executingSkill, eachTarget, excludedTargets, killedByThisSkill, isProcessMonsterAction, damagedMonsters, isAIattack, MPused);
      }
      break;
    case "single":
      // 単体攻撃
      if (currentHit === 0) {
        // 双撃などのfollowingの場合
        if (executedSingleSkillTarget.length > 0) {
          skillTarget = executedSingleSkillTarget[0];
          // ターゲットが存在しない場合は処理を中断
          if (!skillTarget) {
            return;
          }
        } else {
          // 最初のヒット時のみターゲットを決定
          skillTarget = determineSingleTarget(assignedTarget, skillUser, executingSkill, excludedTargets);
          // ターゲットが存在しない場合は処理を中断
          if (!skillTarget) {
            return;
          }
          // みがわり処理 味方補助でないかつみがわり無視でないときに変更
          if (skillTarget.flags.hasSubstitute && !executingSkill.ignoreSubstitute && !(executingSkill.howToCalculate === "none" && executingSkill.targetTeam === "ally")) {
            skillTarget = parties.flat().find((monster) => monster.monsterId === skillTarget.flags.hasSubstitute.targetMonsterId);
          }
          // 初回hitのみ実行 singleのみ、最終的なみがわり処理後のskillTargetをexecutedSingleSkillTargetに格納
          executedSingleSkillTarget.push(skillTarget);
        }
      } else {
        // 2回目以降のヒットの場合、最初のヒットで決定したターゲットを引き継ぐ
        skillTarget = singleSkillTarget;
        // ターゲットが死亡しているかリザオ等した場合に処理を中断
        if (skillTarget.flags.isDead || excludedTargets.has(skillTarget)) {
          return;
        }
      }
      await processHit(skillUser, executingSkill, skillTarget, excludedTargets, killedByThisSkill, isProcessMonsterAction, damagedMonsters, isAIattack, MPused);
      break;
    case "random":
      // ランダム攻撃
      skillTarget = determineRandomTarget(assignedTarget, skillUser, executingSkill, excludedTargets, currentHit);
      // ターゲットが存在しない場合は処理を中断
      if (!skillTarget) {
        return;
      }
      // みがわり処理 味方補助でないかつみがわり無視でないときに変更
      if (skillTarget.flags.hasSubstitute && !executingSkill.ignoreSubstitute && !(executingSkill.howToCalculate === "none" && executingSkill.targetTeam === "ally")) {
        skillTarget = parties.flat().find((monster) => monster.monsterId === skillTarget.flags.hasSubstitute.targetMonsterId);
      }
      await processHit(skillUser, executingSkill, skillTarget, excludedTargets, killedByThisSkill, isProcessMonsterAction, damagedMonsters, isAIattack, MPused);
      break;
    case "self":
      // 自分自身をターゲット
      skillTarget = skillUser;
      await processHit(skillUser, executingSkill, skillTarget, excludedTargets, killedByThisSkill, isProcessMonsterAction, damagedMonsters, isAIattack, MPused);
      break;
    case "field":
      // meと同様
      skillTarget = skillUser;
      await processHit(skillUser, executingSkill, skillTarget, excludedTargets, killedByThisSkill, isProcessMonsterAction, damagedMonsters, isAIattack, MPused);
      break;
    case "dead":
      // 蘇生特技
      skillTarget = assignedTarget;
      await processHit(skillUser, executingSkill, skillTarget, excludedTargets, killedByThisSkill, isProcessMonsterAction, damagedMonsters, isAIattack, MPused);
      break;
    default:
      console.error("無効なターゲットタイプ:", executingSkill.targetType);
  }

  // 死亡時発動前なので、リザオ処理やゾンビ処理がまだ行われていないタイミング
  // エルギ変身判定
  for (const party of parties) {
    const targetMonsters = party.filter(
      (monster) => monster.name === "憎悪のエルギオス" && !monster.flags.hasTransformed && !monster.flags.isDead && !monster.flags.isZombie && monster.flags.transformationCount === 2
    );
    for (const targetErugi of targetMonsters) {
      await transformTyoma(targetErugi);
    }
  }
  // シンリ解除
  // 全体特技ではskillTargetを毎hit変更していない(eachTarget)上に、反射なども反映されない なので、skillUserやskillTargetで判定するよりかは両方について判定
  // 現状、何度も実行されている 超伝説死亡時にまわりは解除されない
  for (let i = 0; i < 2; i++) {
    if (fieldState.completeDeathCount[i] > 0) {
      for (const monster of parties[i]) {
        // 生存しているあるいは亡者化予定のtargetから蘇生封じを削除
        if ((!monster.flags.isDead || monster.flags.willZombify) && monster.buffs.reviveBlock && monster.buffs.reviveBlock.name === "竜衆の鎮魂") {
          delete monster.buffs.reviveBlock;
          await updateMonsterBuffsDisplay(monster);
        }
      }
    }
  }

  // 死亡時発動能力の処理
  await processDeathAction(skillUser, excludedTargets);

  // もしexcludedTargetsにskillUserが含まれていたら、反射死と判定して次のヒットを実行せず終了
  // skillTargetの死亡等は逐次判定してDeathActionも行わずにreturn
  if (excludedTargets.has(skillUser)) {
    return;
  } else {
    // 次のヒット処理
    currentHit++;
    if (!(executingSkill.targetType === "all" && executingSkill.targetTeam === "enemy" && executingSkill.hitNum)) {
      await sleep(70);
    }
    await processHitSequence(skillUser, executingSkill, assignedTarget, excludedTargets, killedByThisSkill, currentHit, skillTarget, null, isProcessMonsterAction, damagedMonsters, isAIattack, MPused);
  }
}

// 単体攻撃のターゲットを決定する関数
function determineSingleTarget(target, skillUser, executingSkill, excludedTargets) {
  const aliveMonsters = (executingSkill.targetTeam === "ally" ? parties[skillUser.teamID] : parties[skillUser.enemyTeamID]).filter((monster) => !monster.flags.isDead);
  if (target && !excludedTargets.has(target) && aliveMonsters.includes(target)) {
    // 指定されたターゲットが生きていて、excludedTargetsに含まれていない場合は、そのターゲットを返す
    return target;
  } else {
    const validTargets = aliveMonsters.filter((monster) => !excludedTargets.has(monster));
    // validTargets が空の場合の処理を追加
    if (validTargets.length > 0) {
      return validTargets[Math.floor(Math.random() * validTargets.length)];
    } else {
      return null; // ターゲットが存在しない場合は null を返す
    }
  }
}

function determineRandomTarget(target, skillUser, executingSkill, excludedTargets, currentHit) {
  if (currentHit === 0) {
    return determineSingleTarget(target, skillUser, executingSkill, excludedTargets);
  } else {
    const aliveMonsters = (executingSkill.targetTeam === "ally" ? parties[skillUser.teamID] : parties[skillUser.enemyTeamID]).filter((monster) => !monster.flags.isDead);
    const validTargets = aliveMonsters.filter((monster) => !excludedTargets.has(monster));
    if (validTargets.length > 0) {
      return validTargets[Math.floor(Math.random() * validTargets.length)];
    } else {
      return null;
    }
  }
}

// ヒット処理を実行する関数
async function processHit(assignedSkillUser, executingSkill, assignedSkillTarget, excludedTargets, killedByThisSkill, isProcessMonsterAction, damagedMonsters, isAIattack, MPused) {
  let skillTarget = assignedSkillTarget;
  let skillUser = assignedSkillUser;
  let isReflection = false;
  let reflectionType = "yosoku";

  // 対象が石化かつ、石化付与でもダメージなしいてはでもなければ無効化
  if (skillTarget.buffs.stoned && !["石化の呪い", "ゴールドアストロン"].includes(executingSkill.name) && !isWaveSkill(executingSkill)) {
    applyDamage(skillTarget, 0);
    return;
  }

  //ザキ処理
  if (executingSkill.hasOwnProperty("zakiProbability")) {
    const zakiResistance = calculateResistance(assignedSkillUser, "zaki", assignedSkillTarget);
    let zakiTarget = assignedSkillTarget;
    let isZakiReflection = false;
    //反射持ちかつ反射無視でない かつ敵対象ならば反射化し、耐性も変更
    if (isSkillReflected(executingSkill, skillTarget)) {
      zakiTarget = assignedSkillUser;
      isZakiReflection = true;
    }
    //ザキ成功時、死亡処理とフラグ格納をして終了 失敗時は普通に継続 ただし、全体特技で一発目で死亡している場合はザキ判定をskip
    //反射は成功時かつ反射時にエフェクト表示のみ実行、失敗時には何事もなかったように再度通常の処理で反射化
    if (!zakiTarget.flags.isDead) {
      if (Math.random() < zakiResistance * executingSkill.zakiProbability) {
        if (isZakiReflection) addMirrorEffect(assignedSkillTarget.iconElementId);
        handleDeath(zakiTarget, false, isZakiReflection, null);
        if (!isZakiReflection) displayMessage(`${zakiTarget.name}の`, "いきのねをとめた!!");
        checkRecentlyKilledFlag(skillUser, zakiTarget, excludedTargets, killedByThisSkill, isZakiReflection);
        return;
      } else if (executingSkill.howToCalculate === "none") {
        // ザキ失敗かつダメージなし特技の場合はmiss表示
        displayMiss(zakiTarget);
      }
    }
  }

  // ダメージなし特技は、みがわり処理後に種別無効処理・反射処理を行ってprocessAppliedEffectに送る
  if (executingSkill.howToCalculate === "none") {
    // 種別回避はミス表示後にreturn 無効化条件: 種別無効バフ保持 かつ敵対象であり無効貫通特技でない かつ波動系でない
    if (
      ((skillTarget.buffs.skillEvasion && executingSkill.type !== "notskill" && Math.random() < skillTarget.buffs.skillEvasion.strength) ||
        (skillTarget.buffs[executingSkill.type + "Evasion"] && !skillTarget.buffs.skillEvasion)) &&
      executingSkill.targetTeam === "enemy" &&
      !executingSkill.ignoreTypeEvasion &&
      executingSkill.appliedEffect !== "divineWave" &&
      executingSkill.appliedEffect !== "disruptiveWave"
    ) {
      col(`${skillUser.name}の${skillTarget.name}に対する${executingSkill.name}は種別無効により回避`);
      applyDamage(skillTarget, 0);
      return;
    }
    // 反射持ちかつ反射無視でない、かつ敵対象で、かつ波動系ではないならば反射化
    if (isSkillReflected(executingSkill, skillTarget) && executingSkill.appliedEffect !== "divineWave" && executingSkill.appliedEffect !== "disruptiveWave") {
      isReflection = true;
      //反射演出
      addMirrorEffect(skillTarget.iconElementId);
      //全ての場合でカンタと同様に、skillUserとskillTargetを入れ替え (applyBuff内での耐性処理のため)
      skillUser = skillTarget;
      skillTarget = assignedSkillUser;
    }
    // isDamageExistingはfalseで送る
    await processAppliedEffectWave(skillTarget, executingSkill, false);
    await processAppliedEffect(skillTarget, executingSkill, skillUser, false, isReflection);
    // damageなしactで死亡時も死亡時発動等を実行するため、追加効果付与直後にrecentlyを持っている敵を、渡されてきたexcludedTargetsに追加して回収
    checkRecentlyKilledFlag(skillUser, skillTarget, excludedTargets, killedByThisSkill, isReflection);
    // 供物対応: actでネルを死亡させた場合、skillTarget以外なのでrecentlyが回収できないのを防止
    // todo: excludedTargetsを利用するわけではないので、供物内で直接入れれば良い？
    for (const party of parties) {
      for (const monster of party) {
        checkRecentlyKilledFlag(null, monster, excludedTargets, killedByThisSkill, isReflection);
      }
    }
    return;
  }

  // AppliedEffect指定のうち、規定値による波動処理を定義
  async function processAppliedEffectWave(buffTarget, executingSkill, isDamageExisting = false) {
    if (executingSkill.appliedEffect) {
      if (executingSkill.appliedEffect === "radiantWave") {
        await executeRadiantWave(buffTarget);
      } else if (executingSkill.appliedEffect === "divineWave") {
        await executeWave(buffTarget, true, isDamageExisting);
      } else if (executingSkill.appliedEffect === "disruptiveWave") {
        await executeWave(buffTarget, false, isDamageExisting);
      }
    }
  }
  // AppliedEffect指定のうち、applyBuffおよびactを定義
  async function processAppliedEffect(buffTarget, executingSkill, skillUser, isDamageExisting, isReflection) {
    if (executingSkill.appliedEffect && executingSkill.appliedEffect !== "radiantWave" && executingSkill.appliedEffect !== "divineWave" && executingSkill.appliedEffect !== "disruptiveWave") {
      applyBuff(buffTarget, structuredClone(executingSkill.appliedEffect), skillUser, isReflection, false, isDamageExisting);
    }
    //act処理と、barおよびバフ表示更新
    if (executingSkill.act) {
      await executingSkill.act(skillUser, buffTarget);
      updateCurrentStatus(skillUser);
      await updateMonsterBuffsDisplay(skillUser);
      updateCurrentStatus(buffTarget);
      await updateMonsterBuffsDisplay(buffTarget);
    }
  }

  // みかわし・マヌーサ処理
  if (["atk", "def", "spd"].includes(executingSkill.howToCalculate) || (executingSkill.howToCalculate === "fix" && (executingSkill.type === "dance" || executingSkill.type === "slash"))) {
    const isMissed = checkEvasionAndDazzle(assignedSkillUser, executingSkill, skillTarget);
    if (isMissed === "miss") {
      applyDamage(skillTarget, 0);
      return;
    }
  }

  //耐性処理
  let resistance = calculateResistance(assignedSkillUser, executingSkill.element, skillTarget, fieldState.isDistorted, executingSkill);

  // 吸収以外の場合に、種別無効処理と反射処理
  let skillUserForAppliedEffect = skillUser;
  let reflectionStrength = 1;
  if (resistance !== -1) {
    // 種別回避はミス表示後にreturn 無効化条件: 種別無効バフ保持 かつ敵対象であり無効貫通特技でない
    if (
      ((skillTarget.buffs.skillEvasion && executingSkill.type !== "notskill" && Math.random() < skillTarget.buffs.skillEvasion.strength) ||
        (skillTarget.buffs[executingSkill.type + "Evasion"] && !skillTarget.buffs.skillEvasion)) &&
      executingSkill.targetTeam === "enemy" &&
      !executingSkill.ignoreTypeEvasion
    ) {
      col(`${skillUser.name}の${skillTarget.name}に対する${executingSkill.name}は種別無効により回避`);
      applyDamage(skillTarget, 0);
      return;
    }
    //反射持ちかつ反射無視でない かつ敵対象ならば反射化し、耐性も変更
    if (isSkillReflected(executingSkill, skillTarget)) {
      isReflection = true;
      resistance = 1;
      //反射演出
      addMirrorEffect(skillTarget.iconElementId);
      //予測のとき: skillUserはそのまま カンタのとき: skillUserをskillTargetに変更 target自身が打ち返す
      const skillType = executingSkill.type === "notskill" ? "slash" : executingSkill.type;
      reflectionStrength = skillTarget.buffs[skillType + "Reflection"].strength || 1;
      if (skillTarget.buffs[skillType + "Reflection"].isKanta) {
        skillUser = skillTarget;
        reflectionType = "kanta";
      }
      //バフは予測カンタにかかわらず反転
      skillUserForAppliedEffect = skillTarget;
      //反射化、skillTargetをskillUserに変更
      skillTarget = assignedSkillUser;
      //反射のときは反射のstrengthを乗算
    }
  }

  // ダメージ計算 反射などで変更されたuser targetおよび耐性を踏まえて計算
  let { damage, isCriticalHit } = calculateDamage(
    skillUser,
    assignedSkillUser,
    executingSkill,
    skillTarget,
    resistance,
    isProcessMonsterAction,
    false,
    isReflection,
    reflectionType,
    reflectionStrength,
    MPused
  );

  // 障壁 ダメージが1以上で判定(もともと0はmiss判定のまま処理)
  let reducedByElementalShield = false; //障壁によって0になっただけで、appliedEffectやダメージ0表示は実行
  const AllElements = ["fire", "ice", "thunder", "wind", "io", "light", "dark"];
  if (
    !isReflection &&
    damage > 0 &&
    skillTarget.buffs.elementalShield &&
    (skillTarget.buffs.elementalShield.targetElement === executingSkill.element || (skillTarget.buffs.elementalShield.targetElement === "all" && AllElements.includes(executingSkill.element)))
  ) {
    reducedByElementalShield = true;
    if (skillTarget.buffs.elementalShield.remain <= damage) {
      // 障壁が割れる場合
      damage -= skillTarget.buffs.elementalShield.remain;
      delete skillTarget.buffs.elementalShield;
      await updateMonsterBuffsDisplay(skillTarget);
      addHexagonShine(skillTarget.iconElementId, true);
    } else {
      skillTarget.buffs.elementalShield.remain -= damage;
      damage = 0;
      addHexagonShine(skillTarget.iconElementId, false);
    }
  }

  // applyDamage実行前に、appliedEffectのいては系によるリザオ解除を実行
  if (
    (reducedByElementalShield || damage > 0) &&
    executingSkill.appliedEffect &&
    (executingSkill.appliedEffect === "disruptiveWave" || executingSkill.appliedEffect === "divineWave") &&
    skillTarget.buffs.revive &&
    !skillTarget.buffs.revive.unDispellable
  ) {
    if (executingSkill.appliedEffect === "divineWave" || !skillTarget.buffs.revive.divineDispellable) {
      delete skillTarget.buffs.revive;
    }
  }

  applyDamage(skillTarget, damage, resistance, false, reducedByElementalShield, isCriticalHit, isReflection, skillUser);

  // wave系はtargetの死亡にかかわらずダメージ存在時に確実に実行(死亡時発動によるリザオ蘇生前に解除)
  if (reducedByElementalShield || damage > 0) {
    await processAppliedEffectWave(skillTarget, executingSkill, true);
  }
  // それ以外の追加効果は  常に実行 または target生存かつdamageが0超えのときに追加効果付与を実行 skillUserForAppliedEffectで完全に反転して渡す
  if (executingSkill.alwaysAct || (!skillTarget.flags.recentlyKilled && (reducedByElementalShield || damage > 0))) {
    await processAppliedEffect(skillTarget, executingSkill, skillUserForAppliedEffect, true, isReflection);
  }

  // monsterActionまたはAI追撃のとき、反撃対象にする
  if ((isProcessMonsterAction || isAIattack) && (reducedByElementalShield || damage > 0)) {
    if (!damagedMonsters.includes(skillTarget.monsterId)) {
      damagedMonsters.push(skillTarget.monsterId);
    }
  }

  // 与ダメージ依存HP吸収
  if (executingSkill.absorptionRatio && !isReflection && resistance !== -1 && damage > 0) {
    const absorptionAmount = Math.floor(damage * executingSkill.absorptionRatio); // 切り捨て
    applyDamage(skillUser, absorptionAmount, -1);
  }

  // ダメージと付属act処理直後にrecentlyを持っている敵を、渡されてきたexcludedTargetsに追加して回収
  checkRecentlyKilledFlag(skillUser, skillTarget, excludedTargets, killedByThisSkill, isReflection);
}

function calculateDamage(
  skillUser,
  assignedSkillUser,
  executingSkill,
  skillTarget,
  resistance,
  isProcessMonsterAction = false,
  isSimulatedCalculation = false,
  isReflection = false,
  reflectionType = null,
  reflectionStrength = 1,
  MPused = null
) {
  let baseDamage = 0;
  let randomMultiplier = 1;
  let damage = 0;
  let isCriticalHit = false;
  const AllElements = ["fire", "ice", "thunder", "wind", "io", "light", "dark"];
  if (executingSkill.howToCalculate === "fix") {
    baseDamage = executingSkill.damage;
    if (!executingSkill.fixedDamage) {
      if (executingSkill.damageByLevel) {
        randomMultiplier = Math.floor(Math.random() * 21) * 0.01 + 0.9;
      } else {
        randomMultiplier = Math.floor(Math.random() * 11) * 0.01 + 0.95;
      }
    }
  } else if (executingSkill.howToCalculate === "MP") {
    // マダンテ系 呪文会心なし 乱数なし メタルボディの消費MP増加では増えない 連携倍率乗らない
    const MPbase = MPused === null ? calculateMPcost(skillUser, executingSkill) : MPused;
    baseDamage = Math.floor(executingSkill.MPDamageRatio * MPbase);
  } else if (executingSkill.ratio) {
    const status = {
      atk: skillUser.currentStatus.atk,
      def: skillUser.currentStatus.def,
      spd: skillUser.currentStatus.spd,
      int: skillUser.currentStatus.int,
    }[executingSkill.howToCalculate];

    //魅了判定と超ドレアム判定 以下targetDefを用いる
    let targetDef = skillTarget.currentStatus.def;
    if (skillTarget.buffs.tempted) {
      targetDef = 1;
    } else if (skillUser.name === "超ドレアム") {
      targetDef *= 0.5;
    }

    // 会心の一撃判定
    let criticalHitProbability = executingSkill.criticalHitProbability;
    if (criticalHitProbability !== undefined) {
      // criticalHitProbabilityが存在する場合
      isCriticalHit = Math.random() < criticalHitProbability;
    } else if (executingSkill.howToCalculate !== "int" && !isSimulatedCalculation) {
      // criticalHitProbabilityが存在せず、howToCalculateがint(賢さ物理)ではない場合
      isCriticalHit = Math.random() < 0.009;
    }

    if (isCriticalHit) {
      // 会心の一撃成功時 (呪文暴走は別処理)
      baseDamage = status;
      randomMultiplier = Math.floor(Math.random() * 11) * 0.01 + 0.95;
      if (skillUser.gear?.name === "魔神のかなづち") {
        baseDamage *= 2;
      } else if (skillUser.gear?.name === "ボーンクラッシャー") {
        baseDamage *= 1.5;
      }
      if (!isSimulatedCalculation) col("かいしんのいちげき");
    } else {
      // 会心の一撃が発生しない場合
      const statusRatio = targetDef / status;

      if (statusRatio >= 0 && statusRatio < 1.75) {
        // 割った値が0以上1.75未満の場合
        baseDamage = status / 2 - targetDef / 4;
        if (!isSimulatedCalculation) {
          const randomOffset = (Math.random() * baseDamage) / 8 - baseDamage / 16 + Math.random() * 2 - 1;
          baseDamage = Math.floor(baseDamage + randomOffset);
        }
      } else if (statusRatio >= 1.75 && statusRatio < 2) {
        // 割った値が1.75以上2未満の場合
        if (Math.random() < 0.75) {
          baseDamage = Math.floor(Math.random() * (status / 16));
        }
      } else {
        // 割った値が2以上の場合
        if (Math.random() < 0.5) {
          baseDamage = 1;
        }
      }
    }
    baseDamage *= executingSkill.ratio;
  } else if (executingSkill.howToCalculate === "int") {
    // 賢さ物理はratio判定に分岐済
    const { minInt, maxInt, minIntDamage, maxIntDamage } = executingSkill;
    const int = skillUser.currentStatus.int;
    if (int <= minInt) {
      baseDamage = minIntDamage;
    } else if (int >= maxInt) {
      baseDamage = maxIntDamage;
    } else {
      baseDamage = Math.floor(((int - minInt) * (maxIntDamage - minIntDamage)) / (maxInt - minInt)) + Number(minIntDamage);
    }
    // 特技プラスと賢さ差ボーナスを乗算
    const intDiff = skillUser.currentStatus.int - skillTarget.currentStatus.int;
    const intBonus =
      intDiff >= 150
        ? 1.25
        : intDiff >= 140
        ? 1.24
        : intDiff >= 130
        ? 1.23
        : intDiff >= 120
        ? 1.22
        : intDiff >= 110
        ? 1.21
        : intDiff >= 100
        ? 1.2
        : intDiff >= 90
        ? 1.19
        : intDiff >= 80
        ? 1.18
        : intDiff >= 70
        ? 1.17
        : intDiff >= 60
        ? 1.16
        : intDiff >= 50
        ? 1.15
        : intDiff >= 40
        ? 1.14
        : intDiff >= 30
        ? 1.13
        : intDiff >= 20
        ? 1.12
        : intDiff >= 10
        ? 1.11
        : intDiff >= 1
        ? 1.1
        : 1;
    baseDamage *= executingSkill.skillPlus * intBonus;
    randomMultiplier = Math.floor(Math.random() * 11) * 0.01 + 0.95;
    //呪文会心
    const noSpellSurgeList = [
      "カオスストーム",
      "クラックストーム",
      "滅びの呪文",
      "サイコストーム",
      "メラゾストーム",
      "メラゾスペル",
      "メテオ",
      "マヒャドストーム",
      "メドローア",
      "ハザードウェポン",
      "リーサルウェポン",
      "破壊の魔砲",
      "魔弾の流星",
      "催眠の邪弾",
      "奇襲の邪弾",
      "闇討ちの魔弾",
      "海冥の浸食",
      "アルマゲスト",
      "報復の大嵐",
      "クラウンスパーク",
      "インパクトキャノン",
    ];
    if (executingSkill.type === "spell" && !noSpellSurgeList.includes(executingSkill.name) && !isSimulatedCalculation) {
      isCriticalHit = Math.random() < 0.009;
      if (isCriticalHit) {
        // 暴走成功時
        baseDamage *= 1.6;
        col("呪文がぼうそうした");
      }
    }
  }
  // randomMultiplierを各所で設定(または初期値1) 実際のダメ計の場合のみ乱数をかける randomOffsetのみシミュレーション時以外の乱数振れ幅を既に設定済
  if (!isSimulatedCalculation) {
    damage = baseDamage * randomMultiplier;
  } else {
    damage = baseDamage;
  }

  // 反射倍率
  if (isReflection) {
    damage *= reflectionStrength;
  }

  // 会心完全ガード
  if (isCriticalHit && skillTarget.buffs.criticalGuard) {
    damage = 0;
    col("会心完全ガード");
  }

  // 魔神斬りミス処理
  if (executingSkill.missProbability && Math.random() < executingSkill.missProbability) {
    damage = 0;
  }

  // 弱点1.8倍処理
  if (resistance === 1.5 && executingSkill.weakness18) {
    damage *= 1.2;
  }

  // 種族数依存処理 これは反射時も元のskillUserを参照
  if (executingSkill.damageMultiplierBySameRace) {
    const sameRaceCount = countSameRaceMonsters(assignedSkillUser);
    damage *= sameRaceCount;
  }

  let masoDamageMultiplier = 1;
  let abnormalityDamageMultiplier = 1;
  // マソ深度特効 TODO: 反射時の対応
  if (executingSkill.masoMultiplier && skillTarget.buffs.maso) {
    const masoDepth = skillTarget.buffs.maso.strength === 5 ? 4 : skillTarget.buffs.maso.strength;
    masoDamageMultiplier = executingSkill.masoMultiplier[masoDepth];
  }
  // skill特有の特殊計算 状態異常特効
  if (executingSkill.abnormalityMultiplier) {
    abnormalityDamageMultiplier = executingSkill.abnormalityMultiplier(skillUser, skillTarget) || 1;
  }
  // どちらか高い方を適用
  damage *= Math.max(masoDamageMultiplier, abnormalityDamageMultiplier);

  //耐性処理
  damage *= resistance;

  //ぼうぎょ
  if (!executingSkill.ignoreGuard && skillTarget.flags.guard) {
    damage *= 0.5;
  }

  //連携
  if (!isSimulatedCalculation && isProcessMonsterAction && executingSkill.howToCalculate !== "MP") {
    const cooperationDamageMultiplier = {
      1: 1,
      2: 1.2,
      3: 1.3,
      4: 1.4,
      5: 1.5,
      6: 1.5,
    };
    const multiplier = cooperationDamageMultiplier[fieldState.cooperation.count] || 1;
    damage *= multiplier;
  }

  //乗算バフ
  //バイキ
  if (skillUser.buffs.baiki && executingSkill.howToCalculate === "atk" && !executingSkill.ignoreBaiki) {
    // strengthの値に応じた倍率を定義 (strength + 2 をkey)
    const strengthMultipliersForBaiki = {
      0: 0.6, // -2 + 2
      1: 0.8, // -1 + 2
      3: 1.2, //  1 + 2
      4: 1.4, //  2 + 2
    };
    // strengthの値に対応する倍率を取得する
    const strengthKey = skillUser.buffs.baiki.strength + 2;
    const BaikiMultiplier = strengthMultipliersForBaiki[strengthKey];
    if (BaikiMultiplier) {
      damage *= BaikiMultiplier;
    }
  }

  //力溜め系 カンタ系で反射して撃っているとき無効化
  if (!(isReflection && reflectionType === "kanta")) {
    //魔力覚醒 int依存以外も増加
    if (!executingSkill.ignoreManaBoost && executingSkill.type === "spell" && !executingSkill.MPDamageRatio) {
      if (skillUser.buffs.manaBoost) {
        damage *= skillUser.buffs.manaBoost.strength;
      } else if (skillUser.buffs.manaReduction) {
        damage *= skillUser.buffs.manaReduction.strength;
      }
    }
    //力ため 斬撃体技踊りまたは通常攻撃(現状全ての通常攻撃変化に有効)
    if (!executingSkill.ignorePowerCharge && (executingSkill.type === "notskill" || executingSkill.type === "slash" || executingSkill.type === "martial" || executingSkill.type === "dance")) {
      if (skillUser.buffs.powerCharge) {
        damage *= skillUser.buffs.powerCharge.strength;
      } else if (skillUser.buffs.powerWeaken) {
        damage *= skillUser.buffs.powerWeaken.strength;
      }
    }
    //息を吸い込む
    if (skillUser.buffs.breathCharge && executingSkill.type === "breath") {
      damage *= skillUser.buffs.breathCharge.strength;
    }
  }

  //コツ系
  if (skillUser.buffs.breathEnhancement && executingSkill.type === "breath") {
    damage *= 1.15;
  }
  //属性コツ
  if (skillUser.buffs.elementEnhancement && executingSkill.type === "spell" && skillUser.buffs.elementEnhancement.element === executingSkill.element) {
    damage *= 1.15;
  }

  //乗算デバフ
  //魔防・斬撃・体技・息防御
  const barrierTypes = {
    spell: "spellBarrier",
    slash: "slashBarrier",
    martial: "martialBarrier",
    breath: "breathBarrier",
  };
  const barrierType = barrierTypes[executingSkill.type];
  if (skillTarget.buffs[barrierType] && !executingSkill.ignoreBarrier && !(executingSkill.criticalHitProbability && isCriticalHit)) {
    // 確定会心系で会心が出た場合は防御バフ無視
    // strengthの値に応じた倍率を定義
    const strengthMultipliers = {
      0: 2, // -2
      1: 1.5, // -1
      3: 0.5, // 1
      4: 0.25, // 2
    };
    // strengthの値に対応する倍率を取得する
    const strengthKey = skillTarget.buffs[barrierType].strength + 2;
    const BarrierMultiplier = strengthMultipliers[strengthKey];
    damage *= BarrierMultiplier;
  }

  //反射以外の場合にメタル処理
  if (!isReflection) {
    if (skillTarget.buffs.metal) {
      damage *= skillTarget.buffs.metal.strength;
      //メタルキラー処理
      if (skillUser.buffs.metalKiller && skillTarget.buffs.metal.isMetal) {
        damage *= skillUser.buffs.metalKiller.strength;
      }
    } else if (skillTarget.buffs.goddessLightMetal) {
      damage *= 0.75;
    }
  }

  // ダメージ軽減
  if (!executingSkill.ignoreProtection && skillTarget.buffs.protection) {
    damage *= 1 - skillTarget.buffs.protection.strength;
  }
  // クリミス
  if (skillTarget.buffs.crimsonMist) {
    damage *= 1 + skillTarget.buffs.crimsonMist.strength;
  }

  // 特技の種族特効 反射には乗らない
  if (!isReflection && executingSkill.RaceBane && executingSkill.RaceBane.some((targetRace) => skillTarget.race.includes(targetRace))) {
    damage *= executingSkill.RaceBaneValue;
  }
  // みがわり特効
  if (executingSkill.substituteBreaker && skillTarget.flags.isSubstituting) {
    damage *= executingSkill.substituteBreaker;
  }

  // anchorBonus
  if (executingSkill.anchorBonus) {
    const skillUserIndex = turnOrder.indexOf(skillUser);
    // skillUserIndexより後の要素を取得
    const laterMonsters = turnOrder.slice(skillUserIndex + 1);

    // 後の要素が存在しない、または存在したとしても全てが行動予定にないとき
    if (laterMonsters.length === 0 || laterMonsters.every((element) => element.commandInput === "skipThisTurn")) {
      damage *= executingSkill.anchorBonus;
    }
  }

  // HP割合依存
  if (executingSkill.damageByHpPercent) {
    damage *= skillUser.currentStatus.HP / skillUser.defaultStatus.HP;
  }
  // HP割合反転依存
  if (executingSkill.lowHpDamageMultiplier) {
    damage *= -(skillUser.currentStatus.HP / skillUser.defaultStatus.HP) + 2;
  }
  // 反射特攻系
  if (executingSkill.name === "体砕きの斬舞" && skillTarget.buffs.martialReflection) {
    damage *= 3;
  }
  if (
    executingSkill.name === "すさまじいオーラ" &&
    (skillTarget.buffs.slashReflection || skillTarget.buffs.spellReflection || skillTarget.buffs.breathReflection || skillTarget.buffs.danceReflection || skillTarget.buffs.ritualReflection)
  ) {
    damage *= 3;
  }
  if (
    executingSkill.name === "破鏡の円舞" &&
    (skillTarget.buffs.slashReflection || skillTarget.buffs.spellReflection || skillTarget.buffs.breathReflection || skillTarget.buffs.martialReflection || skillTarget.buffs.ritualReflection)
  ) {
    damage *= 3;
  }

  // skill特有の特殊計算
  if (executingSkill.damageMultiplier) {
    damage *= executingSkill.damageMultiplier(skillUser, skillTarget, isReflection) || 1;
  }

  // 乗算装備
  if (skillTarget.gear?.name === "トリリオンダガー") {
    damage *= 1.3;
  }
  if (skillTarget.gear?.name === "ファラオの腕輪" && skillTarget.race.includes("ゾンビ")) {
    damage *= 2;
  }

  // 以下加算処理
  let damageModifier = 0;

  // skillUser対象バフ
  // 装備 錬金が一意に定まるように注意
  if (skillUser.gear) {
    const gearName = skillUser.gear.name;
    // 装備本体 - 竜神のツメ
    if (gearName === "竜神のツメ" && (skillTarget.race.includes("???") || skillTarget.race.includes("ドラゴン"))) {
      damageModifier += 0.1;
    }
    // 装備本体 - 強戦士ハート・闇
    if (gearName === "強戦士ハート・闇" && skillUser.race.includes("悪魔") && executingSkill.type === "spell") {
      damageModifier += 0.15;
    }
    // 装備本体&錬金 - かがやく魔神剣
    if (gearName === "かがやく魔神剣" && executingSkill.type === "slash") {
      damageModifier += 0.05;
      if (skillTarget.race.includes("???")) {
        damageModifier += 0.1;
      }
    }
    // 装備錬金 - 砕き昇天のドラゴン息10, ギラ息10, 体技5%錬金
    if (gearName === "心砕きのヤリ" || gearName === "昇天のヤリ") {
      if (skillUser.race.includes("ドラゴン")) {
        if (executingSkill.type === "breath") {
          damageModifier += 0.1;
        }
      } else if (skillUser.race.includes("スライム")) {
        if (executingSkill.type === "breath" && executingSkill.element === "thunder") {
          damageModifier += 0.1;
        }
      } else if (executingSkill.type === "martial") {
        damageModifier += 0.05;
      }
    }
    // 装備錬金 - 竜神のツメ
    if (gearName === "竜神のツメ") {
      if (executingSkill.type === "slash" && executingSkill.element === "wind") {
        // バギ斬撃10%
        damageModifier += 0.1;
      } else if (!["魔獣", "ドラゴン", "物質", "ゾンビ"].some((targetRace) => skillUser.race.includes(targetRace)) && executingSkill.type === "slash") {
        // 竜神のツメの斬撃5%錬金(S5%錬金対象の系統を除く) todo: 本当は魔獣パの狭間は系統S錬金なので非適用、スラパの狭間には適用すべき
        damageModifier += 0.05;
      }
    }
    // 装備錬金 - 源氏小手の体技5%斬撃3%錬金
    if (gearName === "源氏の小手") {
      if (executingSkill.type === "martial") {
        damageModifier += 0.05;
      } else if (executingSkill.type === "slash") {
        damageModifier += 0.03;
      }
    }
    // 装備錬金 - 水着の真夏の誘惑とバギ呪文10
    if (gearName === "あぶない水着") {
      if (executingSkill.name === "真夏の誘惑") {
        damageModifier += 0.25;
      } else if (skillUser.name === "涼風の魔女グレイツェル" && executingSkill.type === "spell" && executingSkill.element === "wind") {
        damageModifier += 0.1;
      }
    }
    // 装備錬金 - 金槌踊り3%
    if (gearName === "魔神のかなづち" && executingSkill.type === "dance") {
      damageModifier += 0.03;
    }
    // 装備錬金 - 系統爪超魔王錬金
    if (gearName === "系統爪超魔王錬金" && skillTarget.race.includes("超魔王")) {
      damageModifier += 0.3;
    }
    // 装備錬金 - おうごんのツメ ゾンビ息10%
    if (gearName === "おうごんのツメ" && skillUser.race.includes("ゾンビ") && executingSkill.type === "breath") {
      damageModifier += 0.1;
    }
    // 装備錬金 - ハザードネイルのあらしの乱舞25・バギ呪文10
    if (gearName === "ハザードネイル") {
      if (executingSkill.name === "あらしの乱舞") {
        damageModifier += 0.25;
      } else if (skillUser.name === "凶ライオネック" && executingSkill.type === "spell" && executingSkill.element === "wind") {
        damageModifier += 0.1;
      }
    }
    // 装備錬金 - ギラ杖
    if (gearName === "いかずちの杖") {
      if (executingSkill.name === "ギラマータ") {
        damageModifier += 0.32;
      } else if (executingSkill.type === "spell" && executingSkill.element === "thunder") {
        damageModifier += 0.27;
      }
    }
    // 装備錬金 - イオ杖
    if (gearName === "賢者の杖") {
      if (executingSkill.name === "イオマータ") {
        damageModifier += 0.32;
      } else if (executingSkill.type === "spell" && executingSkill.element === "io") {
        damageModifier += 0.27;
      }
    }
    // 装備錬金 - ドルマ杖
    if (gearName === "まがんの杖") {
      if (executingSkill.name === "ドルモーア") {
        damageModifier += 0.37;
      } else if (executingSkill.type === "spell" && executingSkill.element === "dark") {
        damageModifier += 0.27;
      }
    }
    // 装備錬金 - にちりんこん
    if (gearName === "にちりんのこん") {
      if (executingSkill.element === "light") {
        damageModifier += 0.15;
        if (executingSkill.type === "spell" || executingSkill.type === "breath") {
          damageModifier += 0.1;
        }
      }
    }
    // 装備錬金 - デイン杖
    if (gearName === "ようせいの杖" && executingSkill.type === "spell" && executingSkill.element === "light") {
      damageModifier += 0.23;
    }
    // 装備錬金 - メラ杖
    if (gearName === "マグマの杖" && executingSkill.type === "spell" && executingSkill.element === "fire") {
      damageModifier += 0.21;
    }
    // 装備錬金 - ヒャド杖
    if (gearName === "うみなりの杖" && executingSkill.type === "spell" && executingSkill.element === "ice") {
      damageModifier += 0.23;
    }
    // 装備錬金 - ヒャド杖悪魔錬金
    if (gearName === "うみなりの杖悪魔錬金" && executingSkill.type === "spell" && executingSkill.element === "ice") {
      damageModifier += 0.13;
    }
    // 装備錬金 - バギ杖
    if (gearName === "さばきの杖") {
      if (executingSkill.name === "バギクロス") {
        damageModifier += 0.28;
      } else if (executingSkill.type === "spell" && executingSkill.element === "wind") {
        damageModifier += 0.21;
      }
    }
    // 装備錬金 - りゅうおう杖 バーン
    if (skillUser.name === "魔界の神バーン" && gearName === "りゅうおうの杖非素早さ錬金" && executingSkill.type === "spell" && executingSkill.element === "fire") {
      damageModifier += 0.1;
    }
    // 装備本体 - 凶帝王のつるぎ
    if (gearName === "凶帝王のつるぎ" && executingSkill.element === "io") {
      damageModifier += 0.25;
    }

    // 特技錬金の反映
    const skillAlchemyTarget = skillUser.gear.skillAlchemy;
    if (skillAlchemyTarget) {
      // 特定の錬金に対する追加ターゲットの定義
      const alchemyAdditionalTargets = {
        必殺の双撃: ["必殺の双撃後半"],
        咆哮: ["追加用咆哮"],
      }[skillAlchemyTarget];
      // 通常のターゲット判定
      if (skillAlchemyTarget === executingSkill.name || (alchemyAdditionalTargets && alchemyAdditionalTargets.includes(executingSkill.name))) {
        damageModifier += skillUser.gear.skillAlchemyStrength;
      }
    }
  }

  // 全属性バフ
  if (skillUser.buffs.allElementalBoost && AllElements.includes(executingSkill.element)) {
    damageModifier += skillUser.buffs.allElementalBoost.strength;
  }
  // 領界
  const targetDomain = `${executingSkill.element}Domain`;
  if (skillUser.buffs[targetDomain]) {
    damageModifier += 0.3;
  }

  // デュラン
  if (skillUser.id === "dhuran" && (skillTarget.race.includes("超魔王") || skillTarget.race.includes("超伝説")) && hasEnoughMonstersOfType(parties[skillUser.teamID], "悪魔", 5)) {
    damageModifier += 0.5;
  }
  // 禁忌の封印
  if (skillUser.race.includes("悪魔") && parties[skillUser.teamID].some((monster) => monster.id === "tanisu")) {
    damageModifier += 0.5;
  }
  if (skillUser.buffs.tabooSeal) {
    damageModifier -= 0.5;
  }
  // 一族のつるぎ
  if (skillUser.buffs.weaponBuff) {
    damageModifier += skillUser.buffs.weaponBuff.strength;
  }
  // リズ
  if (skillUser.buffs.rizuIceBuff && executingSkill.element === "ice") {
    damageModifier += 0.4;
  }

  // world反撃ののろし
  if (skillUser.buffs.worldBuff) {
    damageModifier += skillUser.buffs.worldBuff.strength;
  }
  // dark闇の増幅
  if (skillUser.buffs.darkBuff) {
    damageModifier += skillUser.buffs.darkBuff.strength;
  }
  // dream
  if (skillUser.buffs.dreamBuff && executingSkill.element === "none") {
    damageModifier += 0.15;
  }
  // バラゾン
  if (skillUser.name === "怨恨の骸バラモスゾンビ" && skillTarget.buffs.poisoned) {
    damageModifier += 0.5;
  }

  // 魔壊
  if (skillUser.buffs.makaiBoost && executingSkill.element === "dark") {
    damageModifier += skillUser.buffs.makaiBoost.strength;
  }

  // skillUserのLSによる増分
  const allyLeaderName = parties[skillUser.teamID][0].name;
  // シャムダLS
  if (allyLeaderName === "闇竜シャムダ" && executingSkill.element === "dark" && executingSkill.type === "slash") {
    damageModifier += 0.25;
  }
  // オルゴアリーナネルLS 体技up
  if ((allyLeaderName === "万物の王オルゴ・デミーラ" || allyLeaderName === "剛拳の姫と獅子王" || allyLeaderName === "死を統べる者ネルゲル") && executingSkill.type === "martial") {
    damageModifier += 0.2;
  }
  // バーバラLS 息up
  if (allyLeaderName === "天空竜と夢の魔女" && executingSkill.type === "breath") {
    damageModifier += 0.2;
  }
  // ネルLS 斬撃up
  if (allyLeaderName === "死を統べる者ネルゲル" && executingSkill.type === "slash") {
    damageModifier += 0.2;
  }
  // 超ピLS 斬撃up
  if (allyLeaderName === "剣神ピサロ" && executingSkill.type === "slash") {
    damageModifier += 0.3;
  }
  // そしでんLS 呪文デインup
  if (allyLeaderName === "そして伝説へ") {
    if (executingSkill.type === "spell") {
      damageModifier += 0.2;
    }
    if (executingSkill.element === "light") {
      damageModifier += 0.2;
    }
  }
  // バーンLS 呪文up
  if (allyLeaderName === "魔界の神バーン" && executingSkill.type === "spell") {
    damageModifier += 0.25;
  }
  // レザームLS 息・乱打up
  if (allyLeaderName === "支配王レゾム・レザーム") {
    if (executingSkill.type === "breath") {
      damageModifier += 0.25;
    }
    if (executingSkill.targetType === "random") {
      damageModifier += 0.1;
    }
  }
  // ラザマLS ゾンビ斬撃息up
  if (allyLeaderName === "ラザマナス" && skillUser.race.includes("ゾンビ") && (executingSkill.type === "slash" || executingSkill.type === "breath")) {
    damageModifier += 0.1;
  }
  // スカスパLS 毒10%
  if (allyLeaderName === "スカルスパイダー" && skillUser.race.includes("ゾンビ") && skillTarget.buffs.poisoned) {
    damageModifier += 0.1;
  }
  // しんりゅうLS ドラゴン呪文18%
  if (allyLeaderName === "降臨しんりゅう" && skillUser.race.includes("ドラゴン") && executingSkill.type === "spell") {
    damageModifier += 0.18;
  }

  ///////// skillTarget対象バフ
  // 装備 錬金が一意に定まるように注意
  if (skillTarget.gear) {
    const gearName = skillTarget.gear.name;
    // 装備錬金 - 竜王杖体技10%軽減
    if ((gearName === "りゅうおうの杖" || gearName === "りゅうおうの杖非素早さ錬金") && executingSkill.type === "martial") {
      damageModifier -= 0.1;
    }
    // 斬撃10%軽減は素早さ錬金がない場合に限定
    if (gearName === "りゅうおうの杖非素早さ錬金" && executingSkill.type === "slash") {
      damageModifier -= 0.1;
    }
    // 装備錬金 - 呪盾体技5%軽減
    if (gearName === "呪われし盾" && executingSkill.type === "martial") {
      damageModifier -= 0.05;
    }
    // 装備効果・錬金 - 聖王の大盾デイン60+5軽減
    if (gearName === "聖王の大盾" && executingSkill.element === "light") {
      damageModifier -= 0.65;
    }
    // 装備効果・錬金 - プラチナシールドメラ息40+10軽減
    if (gearName === "プラチナシールド" && executingSkill.element === "fire" && executingSkill.type === "breath") {
      damageModifier -= 0.5;
    }
    // 狭間系 - 35%軽減
    if (gearName === "狭間の闇の大剣" && executingSkill.type === "slash") {
      damageModifier -= 0.35;
    }
    if (gearName === "狭間の闇のヤリ" && executingSkill.type === "martial") {
      damageModifier -= 0.35;
    }
    if (gearName === "狭間の闇の盾" && executingSkill.type === "spell") {
      damageModifier -= 0.35;
    }
    if (gearName === "狭間の闇のうでわ" && executingSkill.type === "breath") {
      damageModifier -= 0.35;
    }
  }

  // skillTargetのLSによる軽減
  const enemyLeaderName = parties[skillTarget.teamID][0].name;
  // 属性30軽減など
  if (AllElements.includes(executingSkill.element)) {
    if (enemyLeaderName === "メタルゴッデス" && skillTarget.race.includes("スライム")) {
      damageModifier -= 0.3;
    }
    if (enemyLeaderName === "ガルマッゾ" && isBreakMonster(skillTarget)) {
      damageModifier -= 0.3;
    }
    if (enemyLeaderName === "かみさま") {
      damageModifier -= 0.05;
    }
  }
  if (enemyLeaderName === "神獣王ケトス" && skillUser.race.includes("???")) {
    damageModifier -= 0.05;
  }

  // 超セイントボディ
  if (skillTarget.name === "神獣王ケトス" && skillUser.race.includes("???")) {
    damageModifier -= 0.5;
  }

  // 全属性軽減
  if (skillTarget.buffs.allElementalBarrier && AllElements.includes(executingSkill.element)) {
    damageModifier -= skillTarget.buffs.allElementalBarrier.strength;
  }

  //全ダメージ軽減
  if (skillTarget.buffs.sinriReduction) {
    damageModifier -= 0.3;
  }
  if (skillTarget.buffs.fireGuard && executingSkill.element === "fire") {
    damageModifier -= skillTarget.buffs.fireGuard.strength;
  }
  // 被ダメージ増加
  if (skillTarget.buffs.controlOfRapu) {
    damageModifier += 0.2;
  }
  if (skillTarget.buffs.murakumo && executingSkill.type === "breath") {
    damageModifier += 0.5;
  }
  // 一族のつるぎ
  if (skillTarget.buffs.weaponBuff) {
    damageModifier += skillTarget.buffs.weaponBuff.strength;
  }
  // バラゾン
  if (skillTarget.name === "怨恨の骸バラモスゾンビ") {
    damageModifier += 0.5;
  }
  // 特殊系
  // 天使のしるしデフォルト
  if (parties[skillTarget.enemyTeamID].some((monster) => monster.name === "憎悪のエルギオス") && executingSkill.element === "light") {
    damageModifier += 0.3;
  }
  // 天使のしるし
  if (skillTarget.buffs.angelMark && executingSkill.element === "light") {
    damageModifier -= 0.3;
  }

  // skill特有の特殊計算
  if (executingSkill.damageModifier) {
    damageModifier += executingSkill.damageModifier(skillUser, skillTarget);
  }

  // MP依存ではなくかつ完全固定でもないとき、加減算とそしでんバリア・新たなる神・バーン魔獣化を反映
  if (executingSkill.howToCalculate !== "MP" && !executingSkill.fixedDamage) {
    if (executingSkill.name === "混沌のキバ") {
      damageModifier *= 2;
    }
    damage *= damageModifier + 1;
    // そしでん・新たなる神
    let sosidenBarrierMultiplier = 1;
    let garumaBarrierMultiplier = 1;
    let vearnBarrierMultiplier = 1;
    if (skillTarget.buffs.sosidenBarrier) {
      if (["???", "超魔王", "超伝説"].some((targetRace) => skillUser.race.includes(targetRace))) {
        sosidenBarrierMultiplier = 0.2;
      } else {
        sosidenBarrierMultiplier = 0.5;
      }
    }
    // 新たなる神
    if (skillTarget.buffs.garumaBarrier && skillUser.buffs.maso) {
      garumaBarrierMultiplier = 0.6;
    }
    // バーン魔獣化
    if (skillTarget.buffs.vearnBarrier) {
      vearnBarrierMultiplier = 0.25;
    }
    damage *= Math.min(sosidenBarrierMultiplier, garumaBarrierMultiplier, vearnBarrierMultiplier);
  }
  // やみのころも時ダメージ半減 マダンテにも効く
  if (skillTarget.name === "闇の大魔王ゾーマ" && skillTarget.gear && skillTarget.gear.name === "ゾーマのローブ") {
    damage *= 0.5;
  }

  // ダメージ付与処理
  damage = Math.floor(damage);
  //damage上限
  if (skillTarget.buffs.damageLimit && damage > skillTarget.buffs.damageLimit.strength) {
    damage = skillTarget.buffs.damageLimit.strength;
  }
  return { damage, isCriticalHit };
}

function checkEvasionAndDazzle(skillUser, executingSkill, skillTarget) {
  // 固定斬撃・踊りもみかわし処理を実行 skill.filter((skill) => skill.howToCalculate ==="fix" && skill.type ==="dance") or slash
  // 固定踊りは基本的にhit扱い 例外のみマヌーサとみかわし処理を実行
  if (!["キャンセルステップ", "ステテコダンス"].includes(executingSkill.name) && executingSkill.howToCalculate === "fix" && executingSkill.type === "dance") {
    return "hit";
  }
  // マヌーサ処理
  if (skillUser.buffs.dazzle && !executingSkill.ignoreDazzle) {
    if (Math.random() < 0.36) {
      console.log(`${skillTarget.name}はマヌーサで攻撃を外した！`);
      return "miss";
    }
  }
  // みかわし処理
  if (!executingSkill.ignoreEvasion && !skillTarget.buffs.fear && !skillTarget.buffs.sealed && !skillTarget.buffs.tempted) {
    // みかわしバフ
    if (skillTarget.buffs.dodgeBuff) {
      if (Math.random() < skillTarget.buffs.dodgeBuff.strength) {
        console.log(`${skillTarget.name}はタップで攻撃をかわした！`);
        return "miss";
      }
    }
    // 素早さによる回避 通常時はtargetが早いほど回避する
    else {
      //const speedRatio = skillTarget.currentStatus.spd / skillUser.currentStatus.spd;
      const speedRatio = fieldState.isReverse ? skillUser.currentStatus.spd / skillTarget.currentStatus.spd : skillTarget.currentStatus.spd / skillUser.currentStatus.spd;
      let evasionRate = 0;
      if (fieldState.isReverse) {
        // 全体的に控えめに調整
        if (speedRatio >= 1 && speedRatio < 1.5) {
          evasionRate = 0; //下方修正
        } else if (speedRatio >= 1.5 && speedRatio < 1.75) {
          evasionRate = 0.05;
        } else if (speedRatio >= 1.75 && speedRatio < 2) {
          evasionRate = 0.1;
        } else if (speedRatio >= 2 && speedRatio < 2.5) {
          evasionRate = 0.15;
        } else if (speedRatio >= 2.5 && speedRatio < 3) {
          evasionRate = 0.2;
        } else if (speedRatio >= 3) {
          evasionRate = 0.3;
        }
      } else {
        if (speedRatio >= 1 && speedRatio < 1.5) {
          evasionRate = 0.008; //下方修正
        } else if (speedRatio >= 1.5 && speedRatio < 1.75) {
          evasionRate = 0.15;
        } else if (speedRatio >= 1.75 && speedRatio < 2) {
          evasionRate = 0.25;
        } else if (speedRatio >= 2 && speedRatio < 2.5) {
          evasionRate = 0.3;
        } else if (speedRatio >= 2.5 && speedRatio < 3) {
          evasionRate = 0.4;
        } else if (speedRatio >= 3) {
          evasionRate = 0.5;
        }
      }

      if (Math.random() < evasionRate) {
        console.log(`${skillTarget.name}は素早さ差で攻撃をかわした！`);
        return "miss";
      }
    }
  }
  // みかわし・マヌーサ処理が適用されなかった場合
  return "hit";
}

// 耐性ダウン 氷の王国・フロスペ・氷縛等属性処理 通常状態異常耐性判定 通常属性耐性判定(AI2種) ザキ 実際の通常属性耐性判定 耐性表示で実行 　耐性ダウン確率判定などではskillUserをnull指定
// 通常属性耐性判定とAIシミュ、耐性表示(うち通常属性耐性判定)のみ、skillInfoを指定
function calculateResistance(skillUser, executingSkillElement, skillTarget, distorted = false, skillInfo = null) {
  const element = executingSkillElement;
  const executingSkillType = skillInfo ? skillInfo.type : null;
  const isDamageExisting = skillInfo && skillInfo.howToCalculate !== "none" ? true : false;
  const baseResistance = skillTarget.resistance[element] ?? 1;
  const resistanceValues = [-1, 0, 0.25, 0.5, 0.75, 1, 1.5];
  const distortedResistanceValues = [1.5, 1.5, 1.5, 1, 1, 0, -1];
  const AllElements = ["fire", "ice", "thunder", "wind", "io", "light", "dark"]; // 状態異常やザキと区別
  let isHazamaReduction = false;
  // skillInfo存在時(かつ念の為damage存在時)のみ狭間装備を反映
  if (executingSkillType && isDamageExisting && skillTarget.gear && (element === "none" || AllElements.includes(element))) {
    const gearName = skillTarget.gear.name;
    if (
      (gearName === "狭間の闇の大剣" && executingSkillType === "slash") ||
      (gearName === "狭間の闇のヤリ" && executingSkillType === "martial") ||
      (gearName === "狭間の闇の盾" && executingSkillType === "spell") ||
      (gearName === "狭間の闇のうでわ" && executingSkillType === "breath")
    ) {
      isHazamaReduction = true;
    }
  }

  // --- 無属性の処理 ---
  if (element === "notskill") {
    return 1;
  }
  if (element === "none") {
    let noneResistance = 1; // 初期値

    // 念の為skillInfo存在時かつdamage存在時のみ無属性耐性変化を反映
    if (isDamageExisting) {
      if (skillTarget.name === "ダグジャガルマ") {
        if (distorted) {
          noneResistance = 1.5; //歪曲
        } else {
          noneResistance = -1; //非歪曲
        }
      } else if (skillTarget.buffs.nonElementalResistance) {
        noneResistance = 0;
      } else if (isHazamaReduction) {
        noneResistance = 0.75;
      }
    }
    return noneResistance;
  }

  // --- 属性歪曲時 かつ歪曲対象の7属性の処理 ---
  if (distorted && AllElements.includes(element)) {
    let distortedResistanceIndex = resistanceValues.indexOf(baseResistance);

    // 装備効果・属性耐性バフデバフ効果 反転後に無効吸収になる弱点普通は変化させない
    if (distortedResistanceIndex !== 5 && distortedResistanceIndex !== 6) {
      // 装備効果
      if (skillTarget.gear?.[element + "GearResistance"]) {
        distortedResistanceIndex -= skillTarget.gear[element + "GearResistance"];
      }
      // 狭間装備
      if (isHazamaReduction) {
        distortedResistanceIndex -= 1;
      }
      // 属性耐性バフデバフ効果
      if (skillTarget.buffs[element + "Resistance"]) {
        distortedResistanceIndex -= skillTarget.buffs[element + "Resistance"].strength;
      }
      // プリズムヴェール
      if (skillTarget.buffs.prismVeil) {
        distortedResistanceIndex -= skillTarget.buffs.prismVeil.strength;
      }
    }
    // インデックスの範囲を制限
    distortedResistanceIndex = Math.max(0, Math.min(distortedResistanceIndex, 6));
    //ここまでの処理の結果を変換後に格納
    let distortedResistance = distortedResistanceValues[distortedResistanceIndex];

    // skillUserが渡された場合のみ使い手効果を適用 (反転)
    if (skillUser) {
      if (skillUser.buffs[element + "Break"]) {
        // 変換後の耐性値からresistanceValuesのインデックスを取得 変換後の耐性値を本来の耐性表のindexに変えてから操作
        distortedResistanceIndex = resistanceValues.indexOf(distortedResistance);
        // インデックスに対する操作
        distortedResistanceIndex -= skillUser.buffs[element + "Break"].strength;
        // ブレイク深化も同様
        if (skillUser.buffs[element + "BreakBoost"]) {
          distortedResistanceIndex -= skillUser.buffs[element + "BreakBoost"].strength;
        }
        // インデックスの範囲を制限
        distortedResistanceIndex = Math.max(0, Math.min(distortedResistanceIndex, 6));
        // distortedResistanceを更新
        distortedResistance = resistanceValues[distortedResistanceIndex];
      } else if (skillUser.buffs.allElementalBreak) {
        distortedResistanceIndex = resistanceValues.indexOf(distortedResistance);
        distortedResistanceIndex -= skillUser.buffs.allElementalBreak.strength;
        distortedResistanceIndex = Math.max(0, Math.min(distortedResistanceIndex, 6));
        distortedResistance = resistanceValues[distortedResistanceIndex];
      }
    }

    return distortedResistance;
  } else {
    // --- 通常時 または状態異常耐性の処理 ---
    let normalResistanceIndex = resistanceValues.indexOf(baseResistance);

    //もともと無効や吸収のときは処理せずにそのまま格納 それ以外の場合はバフ等があれば反映した後、最大でも無効止まりにする
    if (normalResistanceIndex !== 0 && normalResistanceIndex !== 1) {
      // 装備効果
      if (skillTarget.gear?.[element + "GearResistance"]) {
        normalResistanceIndex -= skillTarget.gear[element + "GearResistance"];
      }
      // 狭間装備
      if (isHazamaReduction) {
        normalResistanceIndex -= 1;
      }
      // 属性耐性バフデバフ効果
      if (skillTarget.buffs[element + "Resistance"]) {
        normalResistanceIndex -= skillTarget.buffs[element + "Resistance"].strength;
      }
      // プリズムヴェール
      if (skillTarget.buffs.prismVeil && AllElements.includes(element)) {
        normalResistanceIndex -= skillTarget.buffs.prismVeil.strength;
      }
      // インデックスの範囲を制限 最大でも無効
      normalResistanceIndex = Math.max(1, Math.min(normalResistanceIndex, 6));
    }
    //ここまでの処理の結果を格納
    let normalResistance = resistanceValues[normalResistanceIndex];

    // skillUserが渡された場合のみ使い手効果を適用
    if (skillUser) {
      if (skillUser.buffs[element + "Break"]) {
        // 通常ブレイク こちらは状態異常使い手なども反映
        normalResistanceIndex += skillUser.buffs[element + "Break"].strength;
        if (skillUser.buffs[element + "BreakBoost"]) {
          normalResistanceIndex += skillUser.buffs[element + "BreakBoost"].strength;
        }
      } else if (skillUser.buffs.allElementalBreak && AllElements.includes(element)) {
        // 全属性の使い手 こちらは状態異常以外の7属性に限定
        normalResistanceIndex += skillUser.buffs.allElementalBreak.strength;
      }
      normalResistanceIndex = Math.max(0, Math.min(normalResistanceIndex, 6));
      normalResistance = resistanceValues[normalResistanceIndex];
      // 大弱点・超弱点処理
      if (normalResistance == 1.5 && skillUser.buffs[element + "SuperBreak"]) {
        normalResistance = 2;
      } else if (normalResistance == 1.5 && skillUser.buffs[element + "UltraBreak"]) {
        normalResistance = 2.5;
      }
    }
    return normalResistance;
  }
}

// 歪曲時に全モンスターに対して、もとが普通弱点の属性の耐性アップダウンバフデバフを削除
async function deleteElementalBuffs() {
  const AllElements = ["fire", "ice", "thunder", "wind", "io", "light", "dark"];
  for (const party of parties) {
    for (const monster of party) {
      for (const element of AllElements) {
        if (monster.resistance[element] >= 1) {
          delete monster.buffs[`${element}Resistance`];
        }
      }
      await updateMonsterBuffsDisplay(monster);
    }
  }
}

// recentlyを持っているmonsterをkilledに追加して回収、ついでに反射死判定
function checkRecentlyKilledFlag(skillUser, skillTarget, excludedTargets, killedByThisSkill, isReflection) {
  if (skillTarget.flags.recentlyKilled) {
    if (!excludedTargets.has(skillTarget)) {
      excludedTargets.add(skillTarget);
      killedByThisSkill.add(skillTarget);
      // ドレアム判定 skillTargetが死亡してかつリザオではない場合、フラグを立てる(リザオ・変身等判定前に判別) 現状ざんよによる倒しは対象外
      if (skillUser && skillUser.name === "魔神ダークドレアム") {
        // reviveしないならば
        if (!(skillTarget.buffs.revive && !skillTarget.buffs.reviveBlock && !skillTarget.buffs.tagTransformation)) {
          skillUser.flags.thisTurn.applyDreamEvasion = true;
        }
      }
      // エルギ判定 自分以外の味方のエルギのカウントを増やす
      // 通常ダメージ 供物(ダメージなしact) ザキ 反射でカウント増加 カウント刻印毒継続は対象外
      const targetMonsters = parties[skillTarget.teamID].filter(
        (monster) => monster.name === "憎悪のエルギオス" && !monster.flags.hasTransformed && !monster.flags.isDead && !monster.flags.isZombie && monster.monsterId !== skillTarget.monsterId
      );
      for (const targetErugi of targetMonsters) {
        if (!targetErugi.flags.transformationCount) {
          targetErugi.flags.transformationCount = 1;
        } else if (targetErugi.flags.transformationCount === 1) {
          targetErugi.flags.transformationCount = 2;
        }
      }
    }
    delete skillTarget.flags.recentlyKilled;
  }
}

// deathActionQueue および processDeathActionの実行中かどうかを示すフラグ: isProcessingDeathActionを使用
// 死亡時発動能力の処理
async function processDeathAction(skillUser, excludedTargets) {
  // キューに死亡時発動能力を持つモンスターを追加する関数
  function enqueueDeathAction(monster) {
    if (monster.flags.beforeDeathActionCheck && !deathActionQueue.includes(monster)) {
      deathActionQueue.unshift(monster);
    }
  }
  // 敵逆順処理
  for (const monster of [...parties[skillUser.enemyTeamID]].reverse()) {
    if (excludedTargets.has(monster)) {
      enqueueDeathAction(monster);
    }
  }
  // 味方逆順処理
  for (const monster of [...parties[skillUser.teamID]].reverse()) {
    if (excludedTargets.has(monster)) {
      enqueueDeathAction(monster);
    }
  }

  if (isProcessingDeathAction) {
    // すでに processDeathAction が実行中の場合は、キューに追加するだけで処理を終了
    return;
  }
  // processDeathAction の実行開始フラグを立てる
  isProcessingDeathAction = true;

  while (deathActionQueue.length > 0) {
    const monster = deathActionQueue.shift();
    delete monster.flags.beforeDeathActionCheck;
    // 亡者化または復活処理に先んじて蘇生待機状態一時フラグを削除 供物のみ、死亡部分の死亡時発動で削除すると変身前に停止してしまうのを防止
    if (!monster.flags.willTransformNeru) {
      delete monster.flags.waitingForRevive;
    }

    // 死亡時発動能力の前に亡者化処理を実行 リザオや変身しない場合のみ
    if ((monster.buffs.revive && !monster.buffs.reviveBlock) || monster.buffs.tagTransformation) {
    } else if (monster.flags.willZombify) {
      await zombifyMonster(monster);
    }

    // 死亡時発動能力の実行
    await executeDeathAbilities(monster);
    // 処理後に、死亡時発動を実行しないマーカーを削除
    delete monster.flags.skipDeathAbility;

    // 復活処理
    if ((monster.buffs.revive && !monster.buffs.reviveBlock) || monster.buffs.tagTransformation) {
      await reviveMonster(monster);
    }
  }
  isProcessingDeathAction = false;
}

// 死亡時発動能力を実行する関数
async function executeDeathAbilities(monster) {
  const abilitiesToExecute = [];
  // 復活とタグ変化が予定されているか判定
  let isReviving = (monster.buffs.revive && !monster.buffs.reviveBlock) || monster.buffs.tagTransformation;
  // 各ability配列の中身を展開して追加
  abilitiesToExecute.push(...(monster.abilities.deathAbilities ?? []));
  abilitiesToExecute.push(...(monster.abilities.additionalDeathAbilities ?? []));
  // finalAbilityを持つものを分離
  const finalAbilities = abilitiesToExecute.filter((ability) => ability.finalAbility);
  const normalAbilities = abilitiesToExecute.filter((ability) => !ability.finalAbility);

  // ability実行部分の関数
  const executeAbility = async (ability) => {
    //実行済 または 蘇生かつ常に実行ではない能力 または使用不可能条件に引っかかった場合はcontinue
    if (
      monster.flags.executedAbilities.includes(ability.name) ||
      (isReviving && !ability.executeOnRevive) ||
      (monster.flags.skipDeathAbility && !ability.ignoreSkipDeathAbilityFlag) ||
      (ability.unavailableIf && ability.unavailableIf(monster))
    ) {
      return;
    }
    await sleep(500);
    if (!ability.disableMessage) {
      if (ability.hasOwnProperty("message")) {
        ability.message(monster);
        await sleep(300);
      } else if (ability.hasOwnProperty("name")) {
        displayMessage(`${monster.name}の特性 ${ability.name}が発動！`);
        await sleep(300);
      }
    }
    await ability.act(monster);
    //実行後の記録
    if (ability.isOneTimeUse) {
      monster.flags.executedAbilities.push(ability.name);
    }
    await sleep(200);
  };

  // 通常のabilityを実行
  for (const ability of normalAbilities) {
    await executeAbility(ability);
  }
  // finalAbilityを持つabilityを実行
  for (const ability of finalAbilities) {
    await executeAbility(ability);
  }
  await sleep(150);
}

// モンスターを蘇生させる関数
async function reviveMonster(monster, HPratio = 1, ignoreReviveBlock = false, skipSleep = false, skipMessage = false) {
  if (!skipSleep) {
    await sleep(400);
  }
  // 亡者含め、死亡してない場合は失敗
  if (!monster.flags.isDead) {
    displayMiss(monster);
    return false;
  }
  if (monster.buffs.tagTransformation) {
    // tag変化は最優先で消費 蘇生封じ無関係
    monster.currentStatus.HP = monster.defaultStatus.HP;
    delete monster.flags.isDead;
    console.log(`なんと${monster.name}が変身した！`);
    if (monster.buffs.tagTransformation.act) {
      await monster.abilities.tagTransformationAct(monster, monster.buffs.tagTransformation.act);
    }
    delete monster.buffs.tagTransformation;
  } else {
    // リザオまたは通常蘇生時、蘇生封じ持ちの場合はreturn
    if (monster.buffs.reviveBlock && !ignoreReviveBlock) {
      delete monster.buffs.revive;
      displayMiss(monster);
      return false;
    }
    // 蘇生封じなしの場合は蘇生
    delete monster.flags.isDead;
    console.log(`なんと${monster.name}が生き返った！`);
    if (!skipMessage) {
      displayMessage(`なんと${monster.name}が生き返った！`);
    }

    // リザオの場合の処理
    if (monster.buffs.revive) {
      monster.currentStatus.HP = Math.ceil(monster.defaultStatus.HP * monster.buffs.revive.strength);
      // abilities.reviveActにmonsterとact: 名前を渡して、abilities内の名前と一致した場合にのみ実行
      if (monster.buffs.revive.act && monster.abilities.reviveAct) {
        // act実行でreviveを再付与してから削除してしまわないよう、nameを保存、バフ削除してからactで再付与
        const oldReviveBuffName = monster.buffs.revive.act;
        delete monster.buffs.revive;
        await monster.abilities.reviveAct(monster, oldReviveBuffName);
      } else {
        delete monster.buffs.revive;
      }
    } else {
      // リザオ以外の通常蘇生の場合の処理
      monster.currentStatus.HP = Math.ceil(monster.defaultStatus.HP * HPratio);
    }
  }
  updateMonsterBar(monster);
  updateBattleIcons(monster);
  await updateMonsterBuffsDisplay(monster);
  if (!skipSleep) {
    await sleep(300);
  }
  return true;
}

// モンスターを亡者化させる関数
async function zombifyMonster(monster) {
  await sleep(400);
  delete monster.flags.isDead;
  delete monster.flags.willZombify;
  monster.flags.isZombie = true;
  if (monster.flags.zombifyActName && monster.abilities.zombifyAct) {
    await monster.abilities.zombifyAct(monster, monster.flags.zombifyActName);
  }
  updateBattleIcons(monster);
  await updateMonsterBuffsDisplay(monster);
  await sleep(300);
}

//AI追撃targetを返す
function decideNormalAttackTarget(skillUser) {
  const enemyParty = parties[skillUser.enemyTeamID];

  // 生きている敵のみに絞り込む
  const aliveEnemies = enemyParty.filter((monster) => !monster.flags.isDead);

  // #1: 状態異常・反射のどちらも持っていない敵を探す
  let candidates = aliveEnemies.filter((monster) => !hasAbnormalityOfAINormalAttack(monster) && !(monster.buffs.slashReflection && monster.buffs.slashReflection.isKanta));
  if (candidates.length > 0) {
    return findLowestHPRateTarget(candidates);
  }

  // #2: 状態異常は持っているが、反射は持っていない敵を探す
  candidates = aliveEnemies.filter((monster) => hasAbnormalityOfAINormalAttack(monster) && !(monster.buffs.slashReflection && monster.buffs.slashReflection.isKanta));
  if (candidates.length > 0) {
    return findLowestHPRateTarget(candidates);
  }

  // #3: 反射を持っている敵を探す
  candidates = aliveEnemies.filter((monster) => monster.buffs.slashReflection && monster.buffs.slashReflection.isKanta);
  if (candidates.length > 0) {
    return findLowestHPRateTarget(candidates);
  }

  // 対象が見つからない場合はnullを返す
  return null;
}

// 最もHP割合が低いモンスターを探すヘルパー関数
function findLowestHPRateTarget(candidates) {
  let target = candidates[0];
  let lowestHPRate = target.currentStatus.HP / target.defaultStatus.HP;
  let lowestHP = target.currentStatus.HP;

  for (let i = 1; i < candidates.length; i++) {
    const currentHPRate = candidates[i].currentStatus.HP / candidates[i].defaultStatus.HP;
    const currentHP = candidates[i].currentStatus.HP;

    if (currentHPRate < lowestHPRate) {
      target = candidates[i];
      lowestHPRate = currentHPRate;
      lowestHP = currentHP;
    } else if (currentHPRate === lowestHPRate && currentHP < lowestHP) {
      target = candidates[i];
      lowestHP = currentHP;
    }
  }
  return target;
}

function hasAbnormalityOfAINormalAttack(monster) {
  const abnormalityKeys = ["confused", "paralyzed", "asleep"];
  for (const key of abnormalityKeys) {
    if (monster.buffs[key]) {
      return true;
    }
  }
  return false;
}

//monster選択部分
//枠をクリック時、ウィンドウを開き、どの枠を選択中か取得、selectingMonsterIcon(partyIcon0-4)、selectingMonsterNum(0-4)
//global: selectingMonsterNumを使用
document.querySelectorAll(".partyIcon").forEach((icon) => {
  icon.addEventListener("click", function () {
    document.body.style.overflow = "hidden"; //todo:?
    document.getElementById("selectMonsterOverlay").style.visibility = "visible";
    document.getElementById("selectMonsterPopupWindow").style.opacity = "1";
    //どの要素をクリックして選択中か格納
    const selectingMonsterIcon = icon.id;
    //要素idから選択中のモンスターの数値を生成
    selectingMonsterNum = Number(selectingMonsterIcon.replace(/(party|Icon)/g, ""));
  });
});

//まわりクリックで閉じる
document.getElementById("selectMonsterOverlay").addEventListener("click", function () {
  //ここselectMonsterBg_grayではなくselectMonsterOverlayにすると、ウィンドウ白部分をタップでウィンドウ閉じるように
  document.getElementById("selectMonsterOverlay").style.visibility = "hidden";
  document.getElementById("selectMonsterPopupWindow").style.opacity = "0";
  document.body.style.overflow = "";
});

//window内の各画像クリックで、選択処理を起動
document.querySelectorAll(".monsterListIcon").forEach((img) => {
  img.addEventListener("click", () => {
    const imgSrc = img.getAttribute("src");
    const selectedMonsterName = imgSrc.replace("images/icons/", "").replace(".jpeg", "");
    selectMonster(selectedMonsterName);
  });
});

//ポップアップ内各画像クリックで、そのモンスターを代入してウィンドウを閉じる
function selectMonster(monsterName) {
  //選択中partyの該当monsterに引数monsterNameとidが等しいmonsterのデータの配列を丸ごと代入
  selectingParty[selectingMonsterNum] = structuredClone(monsters.find((monster) => monster.id == monsterName));
  // 新規生成したselectingMonster内に、initialからdefaultを作成、以下defaultを操作する
  selectingParty[selectingMonsterNum].defaultSkill = [...selectingParty[selectingMonsterNum].initialSkill];
  // disabledSkillsByPlayer配列を生成
  selectingParty[selectingMonsterNum].disabledSkillsByPlayer = [...(selectingParty[selectingMonsterNum].initialAIDisabledSkills || [])];
  //表示更新
  updatePartyIcon(selectingMonsterNum);

  //格納後、新規モンスターの詳細を表示するため、selectingMonsterNumのtabに表示を切り替える
  switchTab(selectingMonsterNum);

  // ポップアップウィンドウを閉じる
  document.getElementById("selectMonsterOverlay").style.visibility = "hidden";
  document.getElementById("selectMonsterPopupWindow").style.opacity = "0";
  document.body.style.overflow = "";

  // 初期表示状態で種選択が無効化されている場合に解除
  disableSeedSelect(false);

  //デフォ装備選択
  if (selectingParty[selectingMonsterNum].defaultGear) {
    selectGear(selectingParty[selectingMonsterNum].defaultGear, selectingMonsterNum);
  }
}

//装備選択部分
//装備枠クリック時、ウィンドウを開き、どの装備枠を選択中か取得
//global: selectingGearNumを使用
document.querySelectorAll(".partyGear").forEach((icon) => {
  icon.addEventListener("click", function () {
    //どの装備をクリックして選択中か格納
    const selectingGear = icon.id;
    //要素idから選択中の装備の数値を生成
    selectingGearNum = Number(selectingGear.replace(/(party|Gear)/g, ""));
    // モンスターが空のときはreturn
    if (Object.keys(selectingParty[selectingGearNum]).length === 0) return;
    document.body.style.overflow = "hidden";
    document.getElementById("selectGearOverlay").style.visibility = "visible";
    document.getElementById("selectGearPopupWindow").style.opacity = "1";
  });
});

//まわりクリックで閉じる
document.getElementById("selectGearOverlay").addEventListener("click", function () {
  //ここselectGearBg_grayではなくselectGearOverlayにすると、ウィンドウ白部分をタップでウィンドウ閉じる
  document.getElementById("selectGearOverlay").style.visibility = "hidden";
  document.getElementById("selectGearPopupWindow").style.opacity = "0";
  document.body.style.overflow = "";
});

//window内の各画像クリックで、選択処理を起動
document.querySelectorAll(".gearList").forEach((img) => {
  img.addEventListener("click", () => {
    const imgSrc = img.getAttribute("src");
    const selectedGearName = imgSrc.replace("images/gear/", "").replace(".jpeg", "");
    selectGear(selectedGearName);
  });
});

//ポップアップ内各画像クリックで、その装備を代入してウィンドウを閉じる
function selectGear(gearName, newSelectingGearNum = null) {
  // 引数存在時は更新
  if (newSelectingGearNum !== null) {
    selectingGearNum = newSelectingGearNum;
  }
  //表示値計算などはcurrentTabを元に情報を取得するため、タブ遷移しておく
  switchTab(selectingGearNum);
  //選択中partyの該当monsterの装備を変更
  const foundGear = gear.find((gear) => gear.id === gearName);
  selectingParty[selectingGearNum].gear = { ...foundGear };
  //表示更新
  updatePartyIcon(selectingGearNum);

  //currentTabや種も不変のため、display再計算と表示変更のみ
  calcAndAdjustDisplayStatus();
  //装備増分表示はreset
  displayGearIncrement();

  // ポップアップウィンドウを閉じる
  document.getElementById("selectGearOverlay").style.visibility = "hidden";
  document.getElementById("selectGearPopupWindow").style.opacity = "0";
  document.body.style.overflow = "";
}
//装備選択部分終了

//switchTabでタブ遷移時や新規モンス選択時起動、currentTabのステータス、特技、種select、種増分表示更新
function adjustStatusAndSkillDisplay() {
  //丸ごと放り込まれているor操作済みのため、ただ引っ張ってくれば良い
  //所持特技名表示変更
  addSkillOptions();
  //種表示変更
  document.getElementById("selectSeedAtk").value = selectingParty[currentTab].seed.atk;
  document.getElementById("selectSeedDef").value = selectingParty[currentTab].seed.def;
  document.getElementById("selectSeedSpd").value = selectingParty[currentTab].seed.spd;
  document.getElementById("selectSeedInt").value = selectingParty[currentTab].seed.int;
  displayGearIncrement();
  changeSeedSelect();
  // AI表示変更
  document.getElementById("changeDefualtAiType").value = selectingParty[currentTab].defaultAiType || "ガンガンいこうぜ";
}

function addSkillOptions() {
  const monster = selectingParty[currentTab];
  const initialSkills = monster.initialSkill;
  const anotherSkills = monster.anotherSkills;
  const familySkills = {
    ドラゴン: ["テンペストブレス", "ほとばしる暗闇", "竜の呪文見切り"],
    ゾンビ: ["ヴェレマータ", "防壁反転"],
    悪魔: ["イオナルーン", "冷酷な氷撃"],
    スライム: ["アイアンゲイザー", "ふしぎなとばり"],
    魔獣: ["ラピッドショット", "聖なる息吹"],
    //自然: ["やすらぎの光", "天光の裁き"],
    物質: ["れっぱの息吹", "氷撃波"], //"リベンジアーツ"
  }[monster.race[0]];
  const familySkillsAvailableForRankS = {
    //ドラゴン: [],
    ゾンビ: ["ポイズンバースト", "ザラキーマ"],
    悪魔: ["ギラマータ"],
    //スライム: [],
    魔獣: ["一刀両断"],
    //自然: [],
    物質: ["プロト・スターフレア", "ピオラ"],
  }[monster.race[0]];
  const superSkills = [
    "メゾラゴン",
    "メラゾロス",
    "バギラ",
    "昇天斬り",
    "おぞましいおたけび",
    "天の裁き",
    "ダイヤモンドダスト",
    "スパークふんしゃ",
    "体技封じの息",
    "キャンセルステップ",
    "体砕きの斬舞",
    "ミラクルムーン",
    "ダメージバリア",
    "防刃の守り",
    "精霊の守り・強",
    "タップダンス",
    "マインドバリア",
    "メラシールド",
    "ピオリム",
    "バイシオン",
    "バイキルト",
    "インテラ",
    "スクルト",
    "マジックバリア",
    "フバーハ",
    "ベホマラー",
    "ベホマ",
    "ザオリク",
    "ザオラル",
    "リザオラル",
    "光のはどう",
    "斬撃よそく",
    "体技よそく",
    "踊りよそく",
    "マホカンタ",
    "おいかぜ",
    "イオナズン",
    "ジゴデイン",
    "サイコキャノン",
    "パンプキンタイフーン",
    "しゃくねつ",
    "パニッシュメント",
    "ジゴスパーク",
    "聖魔拳",
    "聖魔斬",
    "閃光斬",
    "ギガブレイク",
    "炸裂斬",
    "獄炎斬り",
    "氷獄斬り",
    "轟雷斬り",
    "暴風斬り",
    "爆砕斬り",
    "極光斬り",
    "暗獄斬り",
  ];
  let targetCollabSkills = null;
  const hosigoronSkills = ["竜の眼光", "カオスストーム", "ゆうきの旋風", "ほうしの嵐", "息よそく", "クラスマダンテ", "がんせきおとし", "ステテコダンス", "ベホイマ", "封印の光"];
  const hosigoronTargets = ["DARK", "まものテリー&ミレーユ", "スライダーガール", "スライダーヒーロー", "極彩鳥にじくじゃく", "スライダーキッズ", "マジェス・ドレアム", "支配王レゾム・レザーム"];
  if (hosigoronTargets.includes(monster.name)) {
    targetCollabSkills = hosigoronSkills;
  }
  const daikoraSkills = ["息よそく", "ミナカトール", "いやしの光", "黒くかがやく闇", "一刀両断", "ギラマータ", "イオマータ", "バギマータ", "極大消滅呪文"];
  const daikoraTargets = ["竜の騎士ダイ", "アバンの使徒ダイ", "冥竜王ヴェルザー", "陸戦騎ラーハルト", "魂の継承者ヒム", "獣王クロコダイン"];
  if (daikoraTargets.includes(monster.name)) {
    targetCollabSkills = daikoraSkills;
  }
  for (let j = 0; j < 4; j++) {
    const selectElement = document.getElementById(`skill${j}`);
    selectElement.innerHTML = "";

    const option = document.createElement("option");
    option.value = "";
    option.hidden = true;
    option.disabled = true;
    option.textContent = "選択してください";
    selectElement.appendChild(option);

    // 固有特技を追加 (ここはdefaultではなくinitial)
    defaultOptGroup = document.createElement("optgroup");
    defaultOptGroup.label = "固有特技";
    for (const skill of initialSkills) {
      const option = document.createElement("option");
      option.value = skill;
      option.text = skill;
      defaultOptGroup.appendChild(option);
    }
    selectElement.appendChild(defaultOptGroup);

    // その他特技を追加
    if (anotherSkills) {
      anotherOptGroup = document.createElement("optgroup");
      anotherOptGroup.label = "その他特技";
      for (const skill of anotherSkills) {
        const option = document.createElement("option");
        option.value = skill;
        option.text = skill;
        anotherOptGroup.appendChild(option);
      }
      selectElement.appendChild(anotherOptGroup);
    }

    // 系統特技を追加 (狭間を除く)
    const noFamilySkillMonsters = ["ルバンカ", "降臨しんりゅう"];
    if (monster.race.length < 2 && ((monster.rank === 10 && familySkills) || familySkillsAvailableForRankS) && !noFamilySkillMonsters.includes(monster.name)) {
      const familySkillsToUse = [];
      if (monster.rank === 10 && familySkills) {
        familySkillsToUse.push(...familySkills);
      }
      if (familySkillsAvailableForRankS) {
        familySkillsToUse.push(...familySkillsAvailableForRankS);
      }
      if (familySkillsToUse.length > 0) {
        const familyOptGroup = document.createElement("optgroup");
        familyOptGroup.label = "系統特技";

        for (const skill of familySkillsToUse) {
          const option = document.createElement("option");
          option.value = skill;
          option.text = skill;
          familyOptGroup.appendChild(option);
        }
        selectElement.appendChild(familyOptGroup);
      }
    }

    // コラボ特技を追加
    if (targetCollabSkills) {
      collabOptGroup = document.createElement("optgroup");
      collabOptGroup.label = "コラボ卵特技";
      for (const skill of targetCollabSkills) {
        const option = document.createElement("option");
        option.value = skill;
        option.text = skill;
        collabOptGroup.appendChild(option);
      }
      selectElement.appendChild(collabOptGroup);
    }

    // 超マス特技を追加
    const noSuperOptMonsters = ["氷炎の化身", "降臨しんりゅう"];
    if (!monster.race.includes("超魔王") && !monster.race.includes("超伝説") && !noSuperOptMonsters.includes(monster.name) && monster.rank > 7) {
      superOptGroup = document.createElement("optgroup");
      superOptGroup.label = "超マス特技";
      for (const skill of superSkills) {
        const option = document.createElement("option");
        option.value = skill;
        option.text = skill;
        superOptGroup.appendChild(option);
      }
      selectElement.appendChild(superOptGroup);
    }

    // 現在のdefaultSkillを選択状態にする selectMonster内で生成または既に変更されたdefaultをselect要素に代入
    document.getElementById(`skill${j}`).value = monster.defaultSkill[j];
  }
  // タブ遷移や初期選択で挿入されたselect要素のskillに応じてcheckBoxを変更
  adjustCheckBox();
}

function adjustCheckBox() {
  for (let i = 0; i < 4; i++) {
    const targetSkillName = selectingParty[currentTab].defaultSkill[i];
    // タブ遷移や初期選択で挿入されたそれぞれのskillに応じてcheckBoxを変更
    if (isSkillUnavailableForAI(targetSkillName)) {
      // 選択不可の場合はdisable化
      document.getElementById(`skillEnabled${i}`).disabled = true;
      document.getElementById(`skillEnabled${i}`).checked = false;
    } else {
      // 選択可能な場合、disabledは解除
      document.getElementById(`skillEnabled${i}`).disabled = false;
      // disabledSkillsByPlayerに含まれている場合checkを外す
      if (selectingParty[currentTab].disabledSkillsByPlayer.includes(targetSkillName)) {
        document.getElementById(`skillEnabled${i}`).checked = false;
      } else {
        document.getElementById(`skillEnabled${i}`).checked = true;
      }
    }
  }
}

// skill select変更
for (let i = 0; i < 4; i++) {
  document.getElementById(`skill${i}`).addEventListener("change", function (event) {
    const skillIndex = parseInt(event.target.id.replace("skill", ""), 10);
    const newSkillName = event.target.value;
    // 現在のtabのmonsterのskillを変更する
    changeDefaultSkill(selectingParty[currentTab], skillIndex, newSkillName);
  });
}

// 関数実行時はselect表示が更新されないので注意 currentTabでないmonsterを変更するのは問題ないが
function changeDefaultSkill(monster, skillIndex, newSkillName) {
  const oldSkillName = monster.defaultSkill[skillIndex];
  // select表示は更新済なので内部データを更新
  monster.defaultSkill[skillIndex] = newSkillName;
  // 前のskillを記録 更新後もし4枠内に存在しない場合はdisabledSkillsByPlayerから削除
  if (!monster.defaultSkill.includes(oldSkillName)) {
    monster.disabledSkillsByPlayer = monster.disabledSkillsByPlayer.filter((skillName) => skillName !== oldSkillName);
  }
  // 新規選択skill(event.target.value)をdisabledSkillsByPlayerから削除してAI使用可能にする
  monster.disabledSkillsByPlayer = monster.disabledSkillsByPlayer.filter((skillName) => skillName !== newSkillName);
  // checkBox全体を更新
  adjustCheckBox();
}

// skillEnabled0 から skillEnabled3 までの checkbox の変更イベントリスナーを設定
for (let i = 0; i < 4; i++) {
  const checkbox = document.getElementById(`skillEnabled${i}`);
  checkbox.addEventListener("change", function (event) {
    const skillIndex = parseInt(event.target.id.replace("skillEnabled", ""), 10);
    const monster = selectingParty[currentTab];
    if (event.target.checked) {
      // checkされた場合、使用禁止リストから削除して使用可能にする
      monster.disabledSkillsByPlayer = monster.disabledSkillsByPlayer.filter((skillName) => skillName !== monster.defaultSkill[skillIndex]);
    } else {
      // checkが外された場合、disabledSkillsByPlayer配列にスキルを追加して使用禁止に (既に存在する場合は追加しない)
      if (!monster.disabledSkillsByPlayer.includes(monster.defaultSkill[skillIndex])) {
        monster.disabledSkillsByPlayer.push(monster.defaultSkill[skillIndex]);
      }
    }
  });
}

//種変更時: 値を取得、party内の現在のtabのmonsterに格納、種max120処理と、seedIncrementCalcによる増分計算、格納、表示
//tab遷移・モンスター変更時: switchTabからadjustStatusAndSkillDisplay、changeSeedSelectを起動、seedIncrementCalcで増分計算 このとき種表示変更は実行済なので前半は無意味
function changeSeedSelect() {
  // 選択された数値を取得
  const selectSeedAtk = document.getElementById("selectSeedAtk").value;
  const selectSeedDef = document.getElementById("selectSeedDef").value;
  const selectSeedSpd = document.getElementById("selectSeedSpd").value;
  const selectSeedInt = document.getElementById("selectSeedInt").value;

  // この新たな値を、selectingParty内の表示中のタブのseed情報に格納
  selectingParty[currentTab].seed.atk = selectSeedAtk;
  selectingParty[currentTab].seed.def = selectSeedDef;
  selectingParty[currentTab].seed.spd = selectSeedSpd;
  selectingParty[currentTab].seed.int = selectSeedInt;
  seedIncrementCalc(selectSeedAtk, selectSeedDef, selectSeedSpd, selectSeedInt);

  // 120上限種無効化処理
  const seedLimit = selectingParty[currentTab].seedLimit || 120;
  // select変化時、全部の合計値を算出、120-その合計値を算出 = remain
  const remainingSelectSeedSum = seedLimit - Number(selectSeedAtk) - Number(selectSeedDef) - Number(selectSeedSpd) - Number(selectSeedInt);
  // すべてのselectで、現状の値+remainを超える選択肢をdisable化
  document.querySelectorAll(".selectSeed").forEach(function (element) {
    const selectedValue = parseInt(element.value);
    const newLimit = remainingSelectSeedSum + selectedValue;

    const options = element.options;
    for (let i = 0; i < options.length; i++) {
      const optionValue = parseInt(options[i].value);
      if (optionValue > newLimit) {
        options[i].disabled = true;
      } else {
        options[i].disabled = false;
      }
    }
  });
}

//増分計算fun selectSeedAtkを元に、増分計算、増分格納、増分表示更新  さらに表示値を更新
function seedIncrementCalc(selectSeedAtk, selectSeedDef, selectSeedSpd, selectSeedInt) {
  //事前定義
  function seedCalc(limit, targetArray) {
    let sum = 0;
    for (let i = 0; i < limit; i++) {
      sum += targetArray[i];
    }
    return sum;
  }
  //種を5で割った数値までの配列内の項をすべて足す
  const atkSeedArrayAtk = [4, 0, 10, 0, 10, 0, 10, 0, 6, 0, 6, 0, 6, 0, 4, 0, 2, 0, 2, 0];
  const atkSeedArrayHP = [0, 4, 0, 4, 0, 4, 0, 3, 0, 3, 0, 2, 0, 2, 0, 2, 0, 1, 0, 1];
  const defSeedArrayDef = [8, 0, 20, 0, 20, 0, 20, 0, 12, 0, 12, 0, 12, 0, 8, 0, 4, 0, 4, 0];
  const defSeedArrayHP = [0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2];
  const defSeedArrayMP = [0, 4, 0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 2, 0, 0];

  const atkSeedLimit = selectSeedAtk / 5;
  const defSeedLimit = selectSeedDef / 5;
  const spdSeedLimit = selectSeedSpd / 5;
  const intSeedLimit = selectSeedInt / 5;

  const HPIncrement = seedCalc(atkSeedLimit, atkSeedArrayHP) + seedCalc(defSeedLimit, defSeedArrayHP) + seedCalc(spdSeedLimit, defSeedArrayMP);
  const MPIncrement = seedCalc(defSeedLimit, defSeedArrayMP) + seedCalc(spdSeedLimit, defSeedArrayHP) + seedCalc(intSeedLimit, atkSeedArrayHP);
  const atkIncrement = seedCalc(atkSeedLimit, atkSeedArrayAtk);
  const defIncrement = seedCalc(defSeedLimit, defSeedArrayDef);
  const spdIncrement = seedCalc(spdSeedLimit, atkSeedArrayAtk);
  const intIncrement = seedCalc(intSeedLimit, defSeedArrayDef);

  //格納
  if (!selectingParty[currentTab].hasOwnProperty("seedIncrement")) {
    selectingParty[currentTab].seedIncrement = {};
  }
  selectingParty[currentTab].seedIncrement.HP = HPIncrement;
  selectingParty[currentTab].seedIncrement.MP = MPIncrement;
  selectingParty[currentTab].seedIncrement.atk = atkIncrement;
  selectingParty[currentTab].seedIncrement.def = defIncrement;
  selectingParty[currentTab].seedIncrement.spd = spdIncrement;
  selectingParty[currentTab].seedIncrement.int = intIncrement;

  //増分表示
  document.getElementById("statusInfoSeedIncrementHP").textContent = `(+${HPIncrement})`;
  document.getElementById("statusInfoSeedIncrementMP").textContent = `(+${MPIncrement})`;
  document.getElementById("statusInfoSeedIncrementatk").textContent = `(+${atkIncrement})`;
  document.getElementById("statusInfoSeedIncrementdef").textContent = `(+${defIncrement})`;
  document.getElementById("statusInfoSeedIncrementspd").textContent = `(+${spdIncrement})`;
  document.getElementById("statusInfoSeedIncrementint").textContent = `(+${intIncrement})`;

  calcAndAdjustDisplayStatus();
}

function calcAndAdjustDisplayStatus() {
  //statusとseedIncrementとgearIncrementを足して、displayStatusを計算、表示値を更新
  const monster = selectingParty[currentTab];
  const gearStatus = monster.gear?.status || {};

  monster.displayStatus = {
    HP: monster.status.HP + monster.seedIncrement.HP + (gearStatus.HP || 0),
    MP: monster.status.MP + monster.seedIncrement.MP + (gearStatus.MP || 0),
    atk: monster.status.atk + monster.seedIncrement.atk + (gearStatus.atk || 0),
    def: monster.status.def + monster.seedIncrement.def + (gearStatus.def || 0),
    spd: monster.status.spd + monster.seedIncrement.spd + (gearStatus.spd || 0),
    int: monster.status.int + monster.seedIncrement.int + (gearStatus.int || 0),
  };

  document.getElementById("statusInfoDisplayStatusHP").textContent = monster.displayStatus.HP;
  document.getElementById("statusInfoDisplayStatusMP").textContent = monster.displayStatus.MP;
  document.getElementById("statusInfoDisplayStatusatk").textContent = monster.displayStatus.atk;
  document.getElementById("statusInfoDisplayStatusdef").textContent = monster.displayStatus.def;
  document.getElementById("statusInfoDisplayStatusspd").textContent = monster.displayStatus.spd;
  document.getElementById("statusInfoDisplayStatusint").textContent = monster.displayStatus.int;

  // ウェイト更新
  calculateWeight();

  // 素早さ予測値の更新
  let firstMonster = null;
  for (const obj of selectingParty) {
    if (Object.keys(obj).length !== 0) {
      // オブジェクトが空でなければ設定してbreak
      firstMonster = obj;
      break;
    }
  }
  // lsや錬金を反映して更新
  const leaderSkill = firstMonster.ls;
  const lsTarget = firstMonster.lsTarget;

  let lsMultiplier = 1;
  // 狭間lsのようなexcludedLsTarget制限はなし
  if ((lsTarget === "all" || monster.race.includes(lsTarget)) && leaderSkill.spd) {
    lsMultiplier = leaderSkill.spd;
  }
  // ルビスを起点に
  if (firstMonster.name === "大地の精霊ルビス") {
    lsMultiplier = countRubisTarget(selectingParty) * 0.03 + 1;
  }
  // 装備効果 key === "spd"はなし
  if (monster.gear) {
    const gearName = monster.gear.name;
    if (monster.gear.alchemy && ["魔獣", "ドラゴン", "ゾンビ", "物質"].some((r) => monster.race.includes(r))) {
      lsMultiplier += 0.05;
    }
    if (isBreakMonster(monster) && (gearName === "凶帝王のつるぎ" || gearName === "ハザードネイル")) {
      lsMultiplier += 0.08;
    }
    if (monster.race.includes("悪魔") && gearName === "うみなりの杖悪魔錬金") {
      lsMultiplier += 0.05;
    }
    // 盗賊ハート
    if (monster.race.includes("悪魔") && gearName === "盗賊ハート・闇") {
      lsMultiplier += 0.05;
    }
    if (monster.race.includes("魔獣") && gearName === "盗賊ハート・獣") {
      lsMultiplier += 0.05;
    }
    if (gearName === "エビルクロー") {
      lsMultiplier += 0.05;
    }
    // 装備のstatusMultiplierを適用
    if (monster.gear.statusMultiplier?.spd) {
      lsMultiplier += monster.gear.statusMultiplier.spd;
    }
  }
  const predictedSpeed = Math.ceil(monster.displayStatus.spd * lsMultiplier);
  document.getElementById("predictedSpeed").textContent = predictedSpeed;
}

function displayGearIncrement() {
  // 各ステータスごとに表示を更新
  const updateStatus = (statusName) => {
    // 初期値 非表示化
    document.getElementById(`statusInfoGearIncrement${statusName}`).style.visibility = "hidden";
    document.getElementById(`statusInfoGearIncrement${statusName}`).textContent = "0";
    // 装備が存在してかつ0より大きければ表示
    if (selectingParty[currentTab].gear) {
      const statusValue = selectingParty[currentTab].gear.status[statusName];
      if (statusValue > 0) {
        document.getElementById(`statusInfoGearIncrement${statusName}`).style.visibility = "visible";
        document.getElementById(`statusInfoGearIncrement${statusName}`).textContent = `(+${statusValue})`;
      }
    }
  };

  updateStatus("HP");
  updateStatus("MP");
  updateStatus("atk");
  updateStatus("def");
  updateStatus("spd");
  updateStatus("int");
}

// AI変更
document.getElementById("changeDefualtAiType").addEventListener("change", function (event) {
  selectingParty[currentTab].defaultAiType = event.target.value;
});

//タブ処理

//tab選択時の詳細や表示中の切り替えだけ
function addTabClass(targetTabNum) {
  const tabButtons = document.querySelectorAll(".eachTab");
  const targetTabButton = document.getElementById(`tab${targetTabNum}`);
  tabButtons.forEach((tabButton) => {
    tabButton.classList.remove("selectedTab");
    tabButton.textContent = "詳細";
  });
  targetTabButton.classList.add("selectedTab");
  targetTabButton.textContent = "表示中";
}

//global: currentTabを使用
function switchTab(tabNumber) {
  // tab button押した時または新規モンスター選択時に起動、currentTab更新、引数tabNum番目のモンスター情報を取り出して下に表示(ステ、特技、種)
  // tabの中身が存在するとき
  if (Object.keys(selectingParty[tabNumber]).length !== 0) {
    currentTab = tabNumber;
    adjustStatusAndSkillDisplay();
    // タブ自体の詳細/表示中を切り替え
    addTabClass(tabNumber);
    disableSeedSelect(false);
  } else if (tabNumber == 0) {
    // 中身が空かつ0は例外的に空tab選択可能にして、初期表示
    currentTab = tabNumber;
    // タブ自体の詳細/表示中を切り替え
    addTabClass(tabNumber);
    // 各種表示reset
    // skill表示空に
    document.getElementById("skill0").value = "";
    document.getElementById("skill1").value = "";
    document.getElementById("skill2").value = "";
    document.getElementById("skill3").value = "";
    document.querySelectorAll(".skillEnabledCheckBox").forEach((checkbox) => {
      checkbox.disabled = true;
      checkbox.checked = false;
    });
    // AIreset
    document.getElementById("changeDefualtAiType").value = "ガンガンいこうぜ";
    // 種表示reset
    document.getElementById("selectSeedAtk").value = 0;
    document.getElementById("selectSeedDef").value = 0;
    document.getElementById("selectSeedSpd").value = 0;
    document.getElementById("selectSeedInt").value = 0;
    // 増分表示reset
    document.getElementById("statusInfoSeedIncrementHP").textContent = "(+0)";
    document.getElementById("statusInfoSeedIncrementMP").textContent = "(+0)";
    document.getElementById("statusInfoSeedIncrementatk").textContent = "(+0)";
    document.getElementById("statusInfoSeedIncrementdef").textContent = "(+0)";
    document.getElementById("statusInfoSeedIncrementspd").textContent = "(+0)";
    document.getElementById("statusInfoSeedIncrementint").textContent = "(+0)";
    // 表示値reset
    document.getElementById("statusInfoDisplayStatusHP").textContent = "0";
    document.getElementById("statusInfoDisplayStatusMP").textContent = "0";
    document.getElementById("statusInfoDisplayStatusatk").textContent = "0";
    document.getElementById("statusInfoDisplayStatusdef").textContent = "0";
    document.getElementById("statusInfoDisplayStatusspd").textContent = "0";
    document.getElementById("statusInfoDisplayStatusint").textContent = "0";
    // 素早さ予測値reset
    document.getElementById("predictedSpeed").textContent = "";
    // ウェイトresetは関数 空ではないpartyでswitchtab(0)した場合に0表示にならないよう
    calculateWeight();
    // 装備増分表示reset adjustStatusAndSkillDisplayを実行しない分ここで
    displayGearIncrement();
    //種選択無効化
    disableSeedSelect(true);
  }
}
switchTab(0);

// 特技選択無効化・AI選択無効化も相乗り
function disableSeedSelect(boolean) {
  document.querySelectorAll(".selectSeed, select.changeSkill, #changeDefualtAiType").forEach((element) => {
    element.disabled = boolean;
  });
}

document.getElementById("randomParty").addEventListener("click", function () {
  function getRandomUniqueMonsterIds(count) {
    const excludeIds = ["bossmaen"];
    const filteredMonsters = monsters.filter((monster) => !excludeIds.includes(monster.id));
    const randomIds = [];
    while (randomIds.length < count) {
      const randomIndex = Math.floor(Math.random() * filteredMonsters.length);
      const randomMonster = filteredMonsters[randomIndex];
      if (!randomIds.includes(randomMonster.id)) {
        randomIds.push(randomMonster.id);
      }
    }
    return randomIds;
  }
  selectAllPartyMembers(getRandomUniqueMonsterIds(5));
});

// 装備変更がある場合はswitchTab(0);
document.getElementById("drapa").addEventListener("click", function () {
  selectAllPartyMembers(["masudora", "sinri", "rusia", "orochi", "voruka"]);
  selectGear("killerEarrings", 2);
  switchTab(0);
});

document.getElementById("yuzupa").addEventListener("click", function () {
  selectAllPartyMembers(["world", "nerugeru", "erugi", "ifshiba", "skull"]);
  selectGear("holyKingShield", 2);
  switchTab(0);
});

document.getElementById("siragapa").addEventListener("click", function () {
  selectAllPartyMembers(["world", "erugi", "sosiden", "dream", "skull"]);
  changeDefaultSkill(selectingParty[0], 3, "防刃の守り");
  selectGear("hunkiNail", 0);
  changeDefaultSkill(selectingParty[3], 3, "体砕きの斬舞");
  changeDefaultSkill(selectingParty[4], 3, "体技封じの息");
  switchTab(0);
});

document.getElementById("omudopa").addEventListener("click", function () {
  selectAllPartyMembers(["omudo", "rapu", "esta", "dogu", "dorunisu"]);
  selectGear("clownHat", 4);
  switchTab(0);
});

document.getElementById("omuoru").addEventListener("click", function () {
  selectAllPartyMembers(["omudo", "orugo", "nadoraga", "dogu", "dorunisu"]);
});

document.getElementById("marita").addEventListener("click", function () {
  selectAllPartyMembers(["omudo", "zoma", "ryuou", "dorunisu", "oriharu"]);
  selectGear("hazamaSpear", 0);
  switchTab(0);
});

document.getElementById("akumapa").addEventListener("click", function () {
  selectAllPartyMembers(["tanisu", "dhuran", "rogos", "tseru", "zuisho"]);
});

document.getElementById("beastpa").addEventListener("click", function () {
  selectAllPartyMembers(["azu", "gorago", "tenkai", "reopa", "kingreo"]);
});

document.getElementById("surapa").addEventListener("click", function () {
  selectAllPartyMembers(["goddess", "surahero", "suragirl", "surabura", "haguki"]);
});

document.getElementById("slimehazama").addEventListener("click", function () {
  selectAllPartyMembers(["goddess", "surahero", "hazama", "dorameta", "haguki"]);
});

document.getElementById("materialpa").addEventListener("click", function () {
  selectAllPartyMembers(["matter", "him", "weapon", "castle", "golem"]);
});

document.getElementById("zombiepa").addEventListener("click", function () {
  selectAllPartyMembers(["skullspider", "barazon", "razama", "maen", "desuso"]);
});

document.getElementById("masopa").addEventListener("click", function () {
  selectAllPartyMembers(["garumazzo", "garumazard", "buon", "raio", "ultrametakin"]);
  changeDefaultSkill(selectingParty[3], 3, "けがれた狂風");
  selectGear("holyKingShield", 0);
  selectGear("hazardNail", 3);
  switchTab(0);
});

async function selectAllPartyMembers(monsters) {
  for (i = 0; i < monsters.length; i++) {
    selectingMonsterNum = i;
    selectMonster(monsters[selectingMonsterNum]);
  }
  switchTab(0);
  if (!isDeveloperMode) return;
  decideParty();
  await sleep(9);
  // 選択画面を開く
  if (currentPlayer === "B") {
    document.body.style.overflow = "hidden";
    document.getElementById("selectMonsterOverlay").style.visibility = "visible";
    document.getElementById("selectMonsterPopupWindow").style.opacity = "1";
    selectingMonsterNum = 0;
  }
}

const monsters = [
  {
    name: "マスタードラゴン", //44
    id: "masudora",
    rank: 10, // SSが10でそこから下げる
    race: ["ドラゴン"],
    weight: 30,
    status: { HP: 886, MP: 398, atk: 474, def: 521, spd: 500, int: 259 },
    initialSkill: ["天空竜の息吹", "エンドブレス", "テンペストブレス", "煉獄火炎"],
    initialAIDisabledSkills: ["煉獄火炎"],
    anotherSkills: ["グランブレス", "天地雷鳴", "いてつくはどう"],
    defaultGear: "familyNailRadiantWave",
    attribute: {
      initialBuffs: {
        breathEnhancement: { keepOnDeath: true },
        mindAndSealBarrier: { keepOnDeath: true },
      },
      1: { breathCharge: { strength: 1.2 } },
      2: { breathCharge: { strength: 1.5 } },
      3: { breathCharge: { strength: 2 } },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1.15, spd: 1.3 },
    lsTarget: "ドラゴン",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 1, thunder: -1, wind: 1, io: 0.5, light: 0, dark: 1, poisoned: 0, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "宵の華シンリ", //44
    id: "sinri",
    rank: 10,
    race: ["ドラゴン"],
    weight: 25,
    status: { HP: 796, MP: 376, atk: 303, def: 352, spd: 542, int: 498 },
    initialSkill: ["涼風一陣", "神楽の術", "昇天斬り", "タップダンス"],
    anotherSkills: ["神速メラガイアー", "メダパニバリア", "圧縮イオナズン", "ベホマズン"],
    defaultGear: "metalNail",
    attribute: {
      permanentBuffs: {
        mindAndSealBarrier: { divineDispellable: true, duration: 3, probability: 0.25 },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1 }, // ドラゴン系呪文息耐性+1
    lsTarget: "ドラゴン",
    resistance: { fire: 0, ice: 0, thunder: 1, wind: 1, io: 1, light: 0.5, dark: 1, poisoned: 1, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 0.5 },
  },
  {
    name: "魔夏姫アンルシア", //44
    id: "rusia",
    rank: 10,
    race: ["ドラゴン"],
    weight: 28,
    status: { HP: 809, MP: 328, atk: 614, def: 460, spd: 559, int: 304 },
    initialSkill: ["氷華大繚乱", "フローズンシャワー", "おぞましいおたけび", "スパークふんしゃ"],
    anotherSkills: ["サンダーボルト", "偽りの秘剣"],
    defaultGear: "familyNailTyoma",
    attribute: {
      initialBuffs: {
        iceBreak: { keepOnDeath: true, strength: 1 },
        mindBarrier: { keepOnDeath: true },
        demonKingBarrier: { divineDispellable: true },
        spdUp: { strength: 1 },
      },
      1: {
        powerCharge: { strength: 2 },
        protection: { divineDispellable: true, strength: 0.5, duration: 3 },
      },
    },
    seed: { atk: 45, def: 0, spd: 75, int: 0 },
    ls: { HP: 1 },
    lsTarget: "ドラゴン",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 0, thunder: 0, wind: 1, io: 1, light: 1, dark: 0.5, poisoned: 1, asleep: 1, confused: 0, paralyzed: 0, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "怪竜やまたのおろち", //4
    id: "orochi",
    rank: 10,
    race: ["ドラゴン"],
    weight: 28,
    status: { HP: 909, MP: 368, atk: 449, def: 675, spd: 296, int: 286 },
    initialSkill: ["むらくもの息吹", "獄炎の息吹", "ほとばしる暗闇", "防刃の守り"],
    anotherSkills: ["五連竜牙弾", "オーロラブレス"],
    defaultGear: "kudaki",
    attribute: {
      initialBuffs: {
        fireBreak: { keepOnDeath: true, strength: 2 },
        breathEnhancement: { keepOnDeath: true },
        mindBarrier: { keepOnDeath: true },
      },
      evenTurnBuffs: { slashBarrier: { strength: 1 } },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "ドラゴン",
    AINormalAttack: [2, 3],
    resistance: { fire: -1, ice: 1.5, thunder: 0.5, wind: 1, io: 1, light: 1, dark: 0.5, poisoned: 0.5, asleep: 1, confused: 1, paralyzed: 0.5, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 0.5 },
  },
  {
    name: "ヴォルカドラゴン", //44
    id: "voruka",
    rank: 10,
    race: ["ドラゴン"],
    weight: 25,
    status: { HP: 1025, MP: 569, atk: 297, def: 532, spd: 146, int: 317 },
    initialSkill: ["ラヴァフレア", "におうだち", "大樹の守り", "みがわり"],
    anotherSkills: ["かえんりゅう", "ハッピーブレス"],
    defaultGear: "flute",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.75 },
        mpCostMultiplier: { strength: 1.2, keepOnDeath: true },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.3 },
    lsTarget: "ドラゴン",
    resistance: { fire: -1, ice: 1.5, thunder: 0.5, wind: 0.5, io: 1.5, light: 1, dark: 1, poisoned: 1, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "降臨しんりゅう", //44
    id: "sinryu",
    rank: 10,
    race: ["ドラゴン"],
    weight: 28,
    status: { HP: 842, MP: 346, atk: 341, def: 482, spd: 510, int: 550 },
    initialSkill: ["アルマゲスト", "しのルーレット", "タイダルウェイブ", "ほのお"],
    anotherSkills: ["メテオ"],
    defaultGear: "metalNail",
    attribute: {
      initialBuffs: {
        iceBreak: { keepOnDeath: true, strength: 2 },
        demonKingBarrier: { divineDispellable: true },
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { spd: 1.18 },
    lsTarget: "ドラゴン",
    resistance: { fire: 0, ice: 0.5, thunder: 0.5, wind: 1, io: 1, light: 1, dark: 0, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "陸戦騎ラーハルト", //44
    id: "haruto",
    rank: 10,
    race: ["ドラゴン"],
    weight: 25,
    status: { HP: 742, MP: 278, atk: 569, def: 410, spd: 562, int: 337 },
    initialSkill: ["真・ハーケンディストール", "真・閃光さみだれ突き", "スパークふんしゃ", "いやしの光"],
    initialAIDisabledSkills: ["真・ハーケンディストール"],
    defaultGear: "metalNail",
    attribute: {
      initialBuffs: {
        baiki: { strength: 2 },
        spdUp: { strength: 2 },
        spellReflection: { strength: 1, duration: 4, decreaseTurnEnd: true }, // 混乱でも保持
        mindBarrier: { duration: 2 },
        revive: { keepOnDeath: true, divineDispellable: true, strength: 0.5, act: "竜の血に選ばれし者" },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { atk: 1.15, spd: 1.15 },
    lsTarget: "ドラゴン",
    AINormalAttack: [2, 3],
    resistance: { fire: 0.5, ice: 1, thunder: 0.5, wind: 1, io: 0.5, light: 0, dark: 0.5, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 1, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "竜の騎士ダイ", //44
    id: "dai",
    rank: 10,
    race: ["ドラゴン"],
    weight: 30,
    status: { HP: 690, MP: 300, atk: 620, def: 527, spd: 563, int: 381 },
    initialSkill: ["アバンストラッシュ", "空裂斬", "海波斬", "テンペストブレス"],
    anotherSkills: ["大地斬"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        lightBreak: { keepOnDeath: true, strength: 2 },
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
        mindAndSealBarrier: { divineDispellable: true, duration: 3 },
      },
      evenTurnBuffs: {
        powerCharge: { strength: 2 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { atk: 1.2 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 1, thunder: 0.5, wind: 1, io: 0.5, light: -1, dark: 1, poisoned: 1, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "アバンの使徒ダイ", //4
    id: "sdai",
    rank: 9,
    race: ["ドラゴン"],
    weight: 21,
    status: { HP: 628, MP: 271, atk: 575, def: 492, spd: 518, int: 348 },
    initialSkill: ["大地斬", "海波斬", "空裂斬", "防刃の守り"],
    defaultGear: "ryujinNail",
    attribute: {},
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { atk: 1.15 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 1, thunder: 0.5, wind: 1, io: 0.5, light: 0, dark: 1, poisoned: 1, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "凶スカルゴン", //4??
    id: "cursedskull",
    rank: 8,
    race: ["ドラゴン"],
    weight: 8,
    status: { HP: 649, MP: 182, atk: 463, def: 379, spd: 293, int: 189 },
    initialSkill: ["アンカーナックル", "みがわり", "精霊の守り・強", "防刃の守り"],
    defaultGear: "windCharm",
    defaultAiType: "いのちだいじに",
    attribute: {
      evenTurnBuffs: {
        baiki: { strength: 2 },
        intUp: { strength: 2 },
        defUp: { strength: -1 },
        spellBarrier: { strength: -1 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 1, thunder: 0.5, wind: 1, io: 1, light: 1, dark: 0.5, poisoned: 1, asleep: 0.5, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "神獣王WORLD", //最強
    id: "world",
    rank: 10,
    race: ["???"],
    weight: 30,
    status: { HP: 810, MP: 334, atk: 661, def: 473, spd: 470, int: 325 },
    initialSkill: ["超魔滅光", "真・ゆうきの斬舞", "神獣の封印", "斬撃よそく"],
    anotherSkills: ["ミナデイン"],
    defaultGear: "kudaki",
    attribute: {
      initialBuffs: {
        lightBreak: { keepOnDeath: true, strength: 2 },
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
        mindBarrier: { divineDispellable: true, duration: 3 },
        martialReflection: { divineDispellable: true, strength: 1.5, duration: 3 },
      },
      buffsFromTurn2: {
        lightBreakBoost: { strength: 1, maxStrength: 2 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1.13, spd: 1.13, atk: 1.05 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 1, thunder: 0.5, wind: 0.5, io: 1, light: -1, dark: 1, poisoned: 1.5, asleep: 0.5, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 0.5, breathSeal: 1 },
  },
  {
    name: "死を統べる者ネルゲル", //44
    id: "nerugeru",
    rank: 10,
    race: ["超魔王"],
    weight: 40,
    status: { HP: 921, MP: 379, atk: 666, def: 573, spd: 587, int: 372 },
    initialSkill: ["ソウルハーベスト", "黄泉の封印", "暗黒閃", "冥王の奪命鎌"],
    defaultGear: "hunkiNail",
    attribute: {
      initialBuffs: {
        darkBreak: { keepOnDeath: true, strength: 2 },
        mindBarrier: { keepOnDeath: true },
        protection: { divineDispellable: true, strength: 0.5, duration: 3 },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 0.5, ice: 0, thunder: 0, wind: 0.5, io: 1, light: 1, dark: 0, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "憎悪のエルギオス", //44
    id: "erugi",
    rank: 10,
    race: ["超魔王"],
    weight: 40,
    status: { HP: 897, MP: 425, atk: 620, def: 619, spd: 564, int: 366 },
    initialSkill: ["失望の光舞", "パニッシュスパーク", "堕天使の理", "光速の連打"],
    initialAIDisabledSkills: ["光速の連打"],
    defaultGear: "lightCharm",
    attribute: {
      initialBuffs: {
        lightBreak: { keepOnDeath: true, strength: 2 },
        mindBarrier: { keepOnDeath: true },
        protection: { divineDispellable: true, strength: 0.5, duration: 3 },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 1, ice: 0, thunder: 0.5, wind: 0.5, io: 0, light: 1, dark: 0, poisoned: 1, asleep: 0, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "氷炎の化身", //44
    id: "ifshiba",
    rank: 10,
    race: ["???"],
    weight: 25,
    status: { HP: 760, MP: 305, atk: 547, def: 392, spd: 467, int: 422 },
    initialSkill: ["ヘルバーナー", "氷魔のダイヤモンド", "炎獣の爪", "プリズムヴェール"],
    anotherSkills: ["真・氷魔の力", "アイスエイジ", "地獄の火炎", "雷電波"],
    defaultGear: "genjiNail",
    attribute: {
      initialBuffs: {
        tagTransformation: { keepOnDeath: true, act: "幻獣のタッグ" },
        fireBreak: { keepOnDeath: true, strength: 2 },
        iceBreak: { keepOnDeath: true, strength: 2 },
        mindBarrier: { duration: 3 },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: -1, ice: -1, thunder: 1, wind: 1, io: 0.5, light: 1, dark: 0.5, poisoned: 0.5, asleep: 0, confused: 0.5, paralyzed: 1, zaki: 0.5, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "そして伝説へ",
    id: "sosiden",
    rank: 10,
    race: ["超伝説"],
    weight: 35,
    status: { HP: 877, MP: 315, atk: 609, def: 495, spd: 505, int: 389 },
    initialSkill: ["でんせつのギガデイン", "いてつくマヒャド", "閃光ジゴデイン", "ロトの剣技"],
    initialAIDisabledSkills: ["でんせつのギガデイン", "ロトの剣技"],
    anotherSkills: ["おうじゃのけん"],
    defaultGear: "shoten",
    attribute: {
      initialBuffs: {
        tagTransformation: { keepOnDeath: true, act: "伝説のタッグ3" },
        iceBreak: { unDispellable: true, strength: 2 },
        lightBreak: { keepOnDeath: true, strength: 2 },
        lightSuperBreak: { keepOnDeath: true },
        mindAndSealBarrier: { keepOnDeath: true },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 1, ice: 0, thunder: 0.5, wind: 1, io: 0, light: 0, dark: 1, poisoned: 1, asleep: 0, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "魔神ダークドレアム",
    id: "dream",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 909, MP: 317, atk: 742, def: 525, spd: 504, int: 408 },
    initialSkill: ["真・魔神の絶技", "すさまじいオーラ", "魔神の構え", "斬撃よそく"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        dreamBuff: { keepOnDeath: true },
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
        demonKingBarrier: { divineDispellable: true },
      },
      1: {
        //魔神のいげん
        powerCharge: { strength: 1.1 },
        slashEvasion: { duration: 1, removeAtTurnStart: true, divineDispellable: true },
        spellEvasion: { duration: 1, removeAtTurnStart: true, divineDispellable: true },
        breathEvasion: { duration: 1, removeAtTurnStart: true, divineDispellable: true },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1.2, atk: 1.2 },
    lsTarget: "???",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 0.5, thunder: 1, wind: 1, io: 1, light: 0, dark: 0, poisoned: 1, asleep: 0, confused: 1, paralyzed: 0.5, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "DARK", //4
    id: "dark",
    rank: 10,
    race: ["???"],
    weight: 30,
    status: { HP: 774, MP: 307, atk: 634, def: 480, spd: 483, int: 291 },
    initialSkill: ["魔手黒闇", "ダークミナデイン", "無情な連撃", "神獣の氷縛"],
    defaultGear: "hunkiNail",
    attribute: {
      initialBuffs: {
        darkBreak: { keepOnDeath: true, strength: 2 },
        isUnbreakable: { keepOnDeath: true, left: 3, name: "ラストスタンド" },
        demonKingBarrier: { divineDispellable: true },
        protection: { divineDispellable: true, strength: 0.4, duration: 3, iconSrc: "protectiondivineDispellablestr0.4" }, //クリミス対象
      },
      buffsFromTurn2: {
        darkBreakBoost: { strength: 1, maxStrength: 2 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { spd: 1.15, atk: 1.1, def: 0.75 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 1, ice: 0.5, thunder: 0.5, wind: 1, io: 0.5, light: 1, dark: -1, poisoned: 0, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "マジェス・ドレアム", //4
    id: "majesu",
    rank: 10,
    race: ["???"],
    weight: 30,
    status: { HP: 813, MP: 312, atk: 644, def: 427, spd: 490, int: 277 },
    initialSkill: ["光芒の絶技", "轟雷滅殺剣", "天雷の舞い", "斬撃よそく"],
    anotherSkills: ["テンペストエッジ"],
    defaultGear: "metalNail",
    attribute: {
      initialBuffs: {
        thunderBreak: { keepOnDeath: true, strength: 2 },
        ioBreak: { keepOnDeath: true, strength: 2 },
        lightBreak: { keepOnDeath: true, strength: 2 },
        mindBarrier: { duration: 3 },
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
      },
      2: {
        slashEvasion: { unDispellable: true, duration: 4 },
        spellEvasion: { unDispellable: true, duration: 4 },
        breathEvasion: { unDispellable: true, duration: 4 },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
        thunderBreakBoost: { strength: 1, maxStrength: 3 },
        ioBreakBoost: { strength: 1, maxStrength: 3 },
        lightBreakBoost: { strength: 1, maxStrength: 3 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 1, ice: 1, thunder: 0, wind: 1, io: -1, light: 0, dark: 1, poisoned: 1.5, asleep: 1, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "闇竜シャムダ",
    id: "shamu",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 831, MP: 329, atk: 622, def: 653, spd: 505, int: 203 },
    initialSkill: ["魔壊裂き", "闇竜の構え", "崩壊裂き", "闇の天地"],
    defaultGear: "kudaki",
    attribute: {
      initialBuffs: {
        spellReflection: { strength: 1, keepOnDeath: true },
        mindAndSealBarrier: { keepOnDeath: true },
        darkBreak: { keepOnDeath: true, strength: 2 },
      },
      1: {
        shamuAtk: { strength: 0.2, divineDispellable: true, duration: 3 },
        shamuDef: { strength: 0.2, divineDispellable: true, duration: 3 },
        shamuSpd: { strength: 0.5, divineDispellable: true, duration: 3 },
      },
    },
    seed: { atk: 75, def: 0, spd: 45, int: 0 },
    ls: { HP: 1.25 },
    lsTarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 0.5, ice: 0.5, thunder: 1, wind: 0, io: 1, light: 1.5, dark: -1, poisoned: 0, asleep: 0, confused: 0.5, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ゴア・サイコピサロ",
    id: "asahaka",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 839, MP: 400, atk: 634, def: 582, spd: 527, int: 245 },
    initialSkill: ["深淵の儀式", "暴風の儀式", "禁忌の左腕", "防壁反転"],
    initialAIDisabledSkills: ["禁忌の左腕"],
    defaultGear: "metalNail",
    attribute: {
      initialBuffs: {
        isUnbreakable: { keepOnDeath: true, left: 3, name: "ラストスタンド" },
        windBreak: { keepOnDeath: true, strength: 2 },
        mindBarrier: { duration: 3 },
        ritualReflection: { strength: 1.5, duration: 3, unDispellable: true, dispellableByAbnormality: true },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 1, ice: 0.5, thunder: 0.5, wind: -1, io: 1, light: 1, dark: 0, poisoned: 1, asleep: 0.5, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "アレフガルドの伝説", //44
    id: "arehu",
    rank: 10,
    race: ["超伝説"],
    weight: 35,
    status: { HP: 880, MP: 391, atk: 615, def: 555, spd: 469, int: 279 },
    initialSkill: ["勇者の一撃", "竜王の息吹", "ベギラマの剣", "勇者のきらめき"],
    defaultGear: "shoten",
    attribute: {
      initialBuffs: {
        tagTransformation: { keepOnDeath: true, act: "伝説のタッグ1" },
        fireBreak: { keepOnDeath: true, strength: 2 },
        thunderBreak: { keepOnDeath: true, strength: 2 },
        thunderSuperBreak: { keepOnDeath: true },
        mindBarrier: { keepOnDeath: true },
      },
      evenTurnBuffs: {
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        breathBarrier: { strength: 1 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 1, thunder: 0, wind: 1, io: 1, light: 0.5, dark: 0, poisoned: 1, asleep: 0.5, confused: 0, paralyzed: 0, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "剛拳の姫と獅子王", //44
    id: "arina",
    rank: 10,
    race: ["超伝説"],
    weight: 35,
    status: { HP: 871, MP: 375, atk: 624, def: 514, spd: 483, int: 321 },
    initialSkill: ["閃光裂衝拳", "ホワイトアウト", "マヒャドブロウ", "鉄拳の構え"],
    defaultGear: "shoten",
    attribute: {
      initialBuffs: {
        tagTransformation: { keepOnDeath: true, act: "伝説のタッグ4" },
        iceBreak: { keepOnDeath: true, strength: 2 },
        iceSuperBreak: { keepOnDeath: true },
        mindAndSealBarrier: { keepOnDeath: true },
        baiki: { strength: 2 },
        spdUp: { strength: 2 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1.2 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 0, thunder: 1, wind: 0.5, io: 1, light: 1, dark: 1, poisoned: 1, asleep: 0, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "天空竜と夢の魔女", //44
    id: "babara",
    rank: 10,
    race: ["超伝説"],
    weight: 35,
    status: { HP: 887, MP: 507, atk: 279, def: 506, spd: 441, int: 568 },
    initialSkill: ["究極呪文マダンテ", "黄金の息吹", "メラゾスペル", "もえさかる業火"],
    anotherSkills: ["圧縮マダンテ"],
    defaultGear: "shoten",
    attribute: {
      initialBuffs: {
        tagTransformation: { keepOnDeath: true, act: "伝説のタッグ6" },
        fireBreak: { keepOnDeath: true, strength: 2 },
        lightBreak: { keepOnDeath: true, strength: 1 },
        fireSuperBreak: { keepOnDeath: true },
        lightSuperBreak: { keepOnDeath: true },
        mindAndSealBarrier: { keepOnDeath: true },
        breathReflection: { unDispellable: true, strength: 1.5 },
      },
    },
    seed: { atk: 0, def: 10, spd: 80, int: 30 },
    ls: { MP: 1.2 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 1, thunder: 0.5, wind: 1, io: 1, light: 0, dark: 0.5, poisoned: 1, asleep: 0, confused: 1, paralyzed: 0.5, zaki: 0, dazzle: 1, spellSeal: 0.5, breathSeal: 1 },
  },
  {
    name: "暗黒神と呪われし魔女", //44
    id: "zesika",
    rank: 10,
    race: ["超伝説"],
    weight: 35,
    status: { HP: 908, MP: 472, atk: 252, def: 538, spd: 445, int: 571 },
    initialSkill: ["爆炎の流星", "呪いのつえ", "苦悶の魔弾", "ドルマズン"],
    defaultGear: "shoten",
    attribute: {
      initialBuffs: {
        tagTransformation: { keepOnDeath: true, act: "伝説のタッグ8" },
        ioBreak: { keepOnDeath: true, strength: 2 },
        darkBreak: { keepOnDeath: true, strength: 2 },
        ioSuperBreak: { keepOnDeath: true },
        darkSuperBreak: { keepOnDeath: true },
        mindAndSealBarrier: { keepOnDeath: true },
        martialReflection: { strength: 1.5, duration: 1, removeAtTurnStart: true, unDispellable: true, dispellableByAbnormality: true },
      },
      buffsFromTurn2: {
        martialReflection: { strength: 1.5, duration: 1, removeAtTurnStart: true, unDispellable: true, dispellableByAbnormality: true, probability: 0.2 },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0.5, ice: 1, thunder: 1, wind: 0, io: 0, light: 1, dark: 0, poisoned: 1, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "大勇者と超魔の武人", //44
    id: "aban",
    rank: 10,
    race: ["超伝説"],
    weight: 35,
    status: { HP: 819, MP: 312, atk: 629, def: 450, spd: 453, int: 523 },
    initialSkill: ["破邪のベギラゴン", "クロスレジェンド", "ゴールドフェザー", "無刀陣"],
    anotherSkills: ["灼熱剣舞", "アバンストラッシュ"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        tagTransformation: { keepOnDeath: true, act: "因縁のタッグ" },
        fireBreak: { keepOnDeath: true, strength: 1 },
        thunderBreak: { keepOnDeath: true, strength: 1 },
        ioBreak: { keepOnDeath: true, strength: 1 },
        fireSuperBreak: { keepOnDeath: true },
        mindAndSealBarrier: { keepOnDeath: true },
        countDown: { unDispellableByRadiantWave: true, count: 1, wait1Turn: true },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { atk: 1.2 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0.5, ice: 1, thunder: 1, wind: 1, io: 0.5, light: 0, dark: 0, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 0.5, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "闇の覇者りゅうおう", //44
    id: "tyoryu",
    rank: 10,
    race: ["超魔王"],
    weight: 40,
    status: { HP: 935, MP: 361, atk: 558, def: 658, spd: 447, int: 521 },
    initialSkill: ["邪悪なともしび", "正体をあらわす", "蘇生封じの術", "覇者の怒り"],
    defaultGear: "tyoryuHeart",
    attribute: {
      initialBuffs: {
        fireBreak: { keepOnDeath: true, strength: 2 },
        allElementalBarrier: { strength: 0.5, unDispellable: true, duration: 1 },
        demonKingBarrier: { divineDispellable: true },
        protection: { divineDispellable: true, strength: 0.5, duration: 3 },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { atk: 1.25 },
    lsTarget: "all",
    AINormalAttack: [3],
    resistance: { fire: -1, ice: 1, thunder: 0.5, wind: 0, io: 1, light: 0.5, dark: 0.5, poisoned: 1, asleep: 0.5, confused: 0.5, paralyzed: 0.5, zaki: 0, dazzle: 0.5, spellSeal: 0, breathSeal: 0 },
  },
  {
    name: "剣神ピサロ", //44
    id: "tyopi",
    rank: 10,
    race: ["超魔王"],
    weight: 40,
    status: { HP: 886, MP: 401, atk: 651, def: 604, spd: 592, int: 360 },
    initialSkill: ["裂空の一撃", "葬送の剣技", "いてつく乱舞", "ソウルブレイカー"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        skillEvasion: { keepOnDeath: true, strength: 0.3 },
        windBreak: { keepOnDeath: true, strength: 2 },
        mindBarrier: { keepOnDeath: true },
        protection: { divineDispellable: true, strength: 0.5, duration: 3 },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 1, ice: 0, thunder: 1, wind: -1, io: 0, light: 0.5, dark: 0.5, poisoned: 1, asleep: 0, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "魔界の神バーン", //44
    id: "vearn",
    rank: 10,
    race: ["超魔王"],
    weight: 40,
    status: { HP: 924, MP: 507, atk: 433, def: 538, spd: 501, int: 596 },
    initialSkill: ["真・カラミティウォール", "イオラの嵐", "真・カイザーフェニックス", "第三の瞳"],
    anotherSkills: ["大魔王のメラ"],
    defaultGear: "dragonCaneWithoutSpd",
    attribute: {
      initialBuffs: {
        fireBreak: { keepOnDeath: true, strength: 3 },
        protection: { divineDispellable: true, strength: 0.5, duration: 3 },
        mindBarrier: { keepOnDeath: true },
        slashReflection: { strength: 1, duration: 2, divineDispellable: true, removeAtTurnStart: true, isKanta: true, name: "光魔の杖" }, // 混乱でも解除不可
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 0, ice: 0.5, thunder: 0.5, wind: 1, io: 0, light: 1, dark: 0, poisoned: 0, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "聖獣ムンババ",
    id: "munbaba",
    rank: 10,
    race: ["自然"],
    weight: 28,
    status: { HP: 848, MP: 344, atk: 602, def: 550, spd: 414, int: 226 },
    initialSkill: ["ホーリーナックル", "かばう", "いてつくゆきだま", "ムフォムフォダンス"],
    defaultGear: "familyNail",
    attribute: {
      initialBuffs: {
        iceBreak: { keepOnDeath: true, strength: 1 },
        lightBreak: { keepOnDeath: true, strength: 1 },
        revive: { keepOnDeath: true, divineDispellable: true, strength: 1, act: "神授のチカラ" },
        protection: { strength: 0.34, duration: 3 },
      },
      1: { lightResistance: { strength: 3, targetType: "ally" } },
    },
    seed: { atk: 30, def: 55, spd: 35, int: 0 },
    ls: { HP: 1.3 },
    lsTarget: "all",
    resistance: { fire: 0.5, ice: 0.5, thunder: 1, wind: 0.5, io: 1, light: -1, dark: 1, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "神獣王ケトス", //最強 (最強増分320421)
    id: "ketosu",
    rank: 10,
    race: ["???"],
    weight: 30,
    status: { HP: 964, MP: 340, atk: 258, def: 641, spd: 392, int: 379 },
    initialSkill: ["神獣王の防壁", "空中ふゆう", "みかわしのひやく", "体技よそく"],
    anotherSkills: ["聖なる流星"],
    defaultGear: "thunderCharm",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.75 },
        mpCostMultiplier: { strength: 1.2, keepOnDeath: true },
        mindAndSealBarrier: { keepOnDeath: true },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.3 },
    lsTarget: "all",
    resistance: { fire: 0.5, ice: 0, thunder: 1, wind: 1, io: 0.5, light: 0, dark: 1.5, poisoned: 1.5, asleep: 0, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "大地の精霊ルビス", //4
    id: "rubis",
    rank: 10,
    race: ["???"],
    weight: 30,
    status: { HP: 840, MP: 406, atk: 247, def: 484, spd: 448, int: 543 },
    initialSkill: ["創世の光陰", "ルビスビーム", "精霊の愛", "神獣王の防壁"],
    defaultGear: "dragonCaneWithoutSpd",
    attribute: {
      initialBuffs: {
        lightBreak: { keepOnDeath: true, strength: 2, iconSrc: "lightBreakBoost" },
        mindBarrier: { keepOnDeath: true },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 0, thunder: 0.5, wind: 1, io: 1, light: -1, dark: 1, poisoned: 1, asleep: 0.5, confused: 0, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "支配王レゾム・レザーム", //44
    id: "rezamu",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 831, MP: 418, atk: 353, def: 509, spd: 465, int: 539 },
    initialSkill: ["怨念ノ凶風", "しはいのさくせん", "傀儡ノ調ベ", "カオスストーム"],
    initialAIDisabledSkills: ["カオスストーム"],
    anotherSkills: ["苛烈な暴風"],
    defaultGear: "lightCharm",
    attribute: {
      initialBuffs: {
        windBreak: { keepOnDeath: true, strength: 2 },
        mindBarrier: { keepOnDeath: true },
      },
      1: {
        preemptiveAction: { duration: 2 },
      },
      buffsFromTurn2: {
        windBreakBoost: { strength: 1, maxStrength: 2 },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 1, ice: 0, thunder: 1, wind: -1, io: 0.5, light: 1, dark: 0, poisoned: 1, asleep: 0.5, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 0 },
  },
  {
    name: "暗黒の魔人", //44
    id: "ankoku",
    rank: 10,
    race: ["物質"],
    weight: 30,
    status: { HP: 969, MP: 279, atk: 427, def: 724, spd: 348, int: 287 },
    initialSkill: ["暗黒しょうへき", "おおいかくす", "ザオリク", "だいぼうぎょ"],
    anotherSkills: ["体技よそく", "息よそく", "踊りよそく"],
    defaultGear: "megaton",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        mindBarrier: { duration: 3 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.3 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 0, thunder: 1, wind: 1, io: 0.5, light: 1, dark: -1, poisoned: 1.5, asleep: 0, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "真夏の女神クシャラミ", //44
    id: "natsukusha",
    rank: 10,
    race: ["???"],
    weight: 25,
    status: { HP: 775, MP: 422, atk: 409, def: 404, spd: 516, int: 408 },
    initialSkill: ["真夏の誘惑", "まどいの風", "マホターン", "ぎゃくふう"],
    defaultGear: "swimSuit",
    attribute: {
      permanentBuffs: {
        mindAndSealBarrier: { divineDispellable: true, duration: 3, probability: 0.25 },
      },
      1: {
        dodgeBuff: { strength: 0.5, duration: 3 },
        martialReflection: { divineDispellable: true, strength: 1.5, duration: 3 },
        preemptiveAction: {},
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { MP: 1.2 },
    lsTarget: "all",
    resistance: { fire: 0, ice: 0.5, thunder: 0, wind: 1, io: 0, light: 0.5, dark: 0.5, poisoned: 1, asleep: 0.5, confused: 0, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 0.5, breathSeal: 1 },
  },
  {
    name: "虚空の神ナドラガ", //4
    id: "snadoraga",
    rank: 9,
    race: ["???"],
    weight: 23,
    status: { HP: 827, MP: 274, atk: 463, def: 574, spd: 416, int: 328 },
    initialSkill: ["虚空神の福音", "ザオリク", "スパークふんしゃ", "体技よそく"],
    defaultGear: "dragonCaneWithoutSpd",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.33 },
        specialHealBlock: { keepOnDeath: true },
      },
    },
    seed: { atk: 40, def: 5, spd: 75, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 0.5, thunder: 0.5, wind: 1, io: 1, light: 1.5, dark: 0, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 0 },
  },
  {
    name: "ディアノーグ", //最強? a45 s75振り
    id: "snogu",
    rank: 9,
    race: ["???"],
    weight: 14,
    status: { HP: 603, MP: 272, atk: 474, def: 290, spd: 535, int: 268 },
    initialSkill: ["かがやく息", "スパークふんしゃ", "おぞましいおたけび", "おいかぜ"],
    defaultGear: "lightCharm",
    attribute: {
      1: {
        preemptiveAction: {},
      },
    },
    seed: { atk: 0, def: 0, spd: 0, int: 0 },
    ls: { MP: 1.1 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 1.5, ice: 0, thunder: 0.5, wind: 1, io: 1, light: 1, dark: 1, poisoned: 1, asleep: 1, confused: 0, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "スライダーキッズ", //最強
    id: "kids",
    rank: 9,
    race: ["スライム"],
    weight: 14,
    status: { HP: 743, MP: 196, atk: 434, def: 391, spd: 459, int: 277 },
    initialSkill: ["みがわり・マインドバリア", "竜の眼光", "ザオリク", "カオスストーム"],
    defaultGear: "familyNail",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        damageLimit: { keepOnDeath: true, strength: 250, iconSrc: "none" },
      },
    },
    seed: { atk: 20, def: 25, spd: 75, int: 0 },
    ls: { atk: 1.1, def: 1.1 },
    lsTarget: "スライム",
    resistance: { fire: 1, ice: 1, thunder: 1, wind: 1, io: 1, light: 0, dark: 1, poisoned: 1, asleep: 0.5, confused: 0, paralyzed: 1, zaki: 1, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "スカルナイト",
    id: "skull",
    rank: 8,
    race: ["ゾンビ"],
    weight: 8,
    status: { HP: 483, MP: 226, atk: 434, def: 304, spd: 387, int: 281 },
    initialSkill: ["ルカナン", "みがわり", "ザオリク", "防刃の守り"],
    initialAIDisabledSkills: ["ルカナン"],
    anotherSkills: ["ヘルスピア"],
    defaultGear: "familyNail",
    defaultAiType: "いのちだいじに",
    attribute: {},
    seed: { atk: 20, def: 5, spd: 95, int: 0 },
    ls: { spd: 1.08 },
    lsTarget: "ゾンビ",
    resistance: { fire: 1.5, ice: 1, thunder: 1, wind: 0.5, io: 1, light: 1, dark: 0, poisoned: 1, asleep: 0, confused: 1, paralyzed: 0.5, zaki: 0.5, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "まものテリー&ミレーユ", //最強
    id: "terimire",
    rank: 9,
    race: ["???"],
    weight: 6,
    status: { HP: 604, MP: 285, atk: 327, def: 351, spd: 456, int: 453 },
    initialSkill: ["しもふりおとし", "防刃の守り", "カオスストーム", "竜の眼光"],
    defaultGear: "fireCharm",
    attribute: {
      initialBuffs: {
        mpCostMultiplier: { strength: 2, keepOnDeath: true },
      },
    },
    seed: { atk: 20, def: 5, spd: 95, int: 0 },
    ls: { MP: 1.15 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 0.5, thunder: 0, wind: 1, io: 1, light: -1, dark: 0.5, poisoned: 1, asleep: 0.5, confused: 1, paralyzed: 1, zaki: 0.5, dazzle: 1, spellSeal: 0, breathSeal: 0.5 },
  },
  {
    name: "ルバンカ", //4?
    id: "rubanka",
    rank: 7,
    race: ["物質"],
    weight: 6,
    status: { HP: 486, MP: 335, atk: 175, def: 335, spd: 286, int: 240 },
    initialSkill: ["はげしい炎", "みがわり", "みがわり", "みがわり"],
    defaultGear: "familyNail",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.75, isMetal: true },
        mpCostMultiplier: { strength: 1.2, keepOnDeath: true },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.08 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 0.5, thunder: 1, wind: 1, io: 0, light: 1, dark: 0, poisoned: 0, asleep: 0.5, confused: 1, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "魔扉の災禍オムド・レクス", //44
    id: "omudo",
    rank: 10,
    race: ["超魔王"],
    weight: 40,
    status: { HP: 965, MP: 475, atk: 544, def: 684, spd: 272, int: 554 },
    initialSkill: ["タイムストーム", "零時の儀式", "エレメントエラー", "かくせいリバース"],
    anotherSkills: ["閃光雷弾"],
    defaultGear: "dragonCane",
    attribute: {
      initialBuffs: {
        mindBarrier: { keepOnDeath: true },
        protection: { divineDispellable: true, strength: 0.5, duration: 3 },
      },
      evenTurnBuffs: {
        intUp: { strength: 1 },
        defUp: { strength: 1 },
        spellBarrier: { strength: 1 },
      },
    },
    seed: { atk: 60, def: 60, spd: 0, int: 0 },
    ls: { HP: 1.4, spd: 0.8 },
    lsTarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 1, ice: 1, thunder: 0, wind: 0, io: 1, light: 1, dark: 0, poisoned: 1, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "新たなる神ラプソーン", //44
    id: "rapu",
    rank: 10,
    race: ["超魔王"],
    weight: 40,
    status: { HP: 1108, MP: 470, atk: 392, def: 529, spd: 418, int: 576 },
    initialSkill: ["呪いの儀式", "はめつの流星", "暗黒神の連撃", "真・闇の結界"],
    initialAIDisabledSkills: ["はめつの流星"],
    anotherSkills: ["絶望の爆炎"],
    defaultGear: "hunkiNail",
    attribute: {
      initialBuffs: {
        protection: { divineDispellable: true, strength: 0.5, duration: 3 }, // 50が先
        mindBarrier: { keepOnDeath: true },
        ioBreak: { keepOnDeath: true, strength: 2 },
      },
      evenTurnBuffs: {
        intUp: { strength: 1 },
        defUp: { strength: 1 },
        spellBarrier: { strength: 1 },
      },
      permanentBuffs: {
        slashReflection: { strength: 1, duration: 1, unDispellable: true, isKanta: true, dispellableByAbnormality: true },
        martialReflection: { strength: 1, duration: 1, unDispellable: true, dispellableByAbnormality: true },
      },
    },
    seed: { atk: 70, def: 25, spd: 10, int: 15 },
    ls: { HP: 1.35, int: 1.15 },
    lsTarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 0, ice: 1, thunder: 1, wind: 1, io: 0, light: 0, dark: 0, poisoned: 0, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "万物の王オルゴ・デミーラ",
    id: "orugo",
    rank: 10,
    race: ["超魔王"],
    weight: 40,
    status: { HP: 1040, MP: 424, atk: 660, def: 507, spd: 497, int: 354 },
    initialSkill: ["もえさかるほむら", "無比なる覇気", "破鏡の円舞", "魔空の一撃"],
    defaultGear: "kanazuchi",
    attribute: {
      initialBuffs: {
        mindBarrier: { keepOnDeath: true },
        fireBreak: { keepOnDeath: true, strength: 2 },
        protection: { divineDispellable: true, strength: 0.5, duration: 3 },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 95, def: 25, spd: 0, int: 0 },
    ls: { HP: 1.2 },
    lsTarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 0, ice: 0, thunder: 1, wind: 1, io: 1, light: 0, dark: 0, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "地獄の帝王エスターク", //最速?
    id: "esta",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 862, MP: 305, atk: 653, def: 609, spd: 546, int: 439 },
    initialSkill: ["必殺の双撃", "帝王のかまえ", "体砕きの斬舞", "ザオリク"],
    initialAIDisabledSkills: ["体砕きの斬舞"],
    anotherSkills: ["いてつくはどう"],
    defaultGear: "estaSword",
    attribute: {
      initialBuffs: {
        demonKingBarrier: { divineDispellable: true },
        protection: { strength: 0.5, duration: 3 },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 95, def: 15, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [3, 4],
    resistance: { fire: 0, ice: 0.5, thunder: 1, wind: 0.5, io: 1, light: 1, dark: 0.5, poisoned: 1, asleep: 1.5, confused: 0.5, paralyzed: 0.5, zaki: 0, dazzle: 0, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "邪竜神ナドラガ",
    id: "nadoraga",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 906, MP: 304, atk: 500, def: 619, spd: 454, int: 355 },
    initialSkill: ["翠嵐の息吹", "竜の波濤", "冥闇の息吹", "虚空神の福音"],
    initialAIDisabledSkills: ["竜の波濤"],
    anotherSkills: ["業炎の息吹"],
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.33 },
        specialHealBlock: { keepOnDeath: true },
        breathEnhancement: { keepOnDeath: true },
        mindBarrier: { duration: 3 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 0.5, thunder: 0, wind: 1, io: 1, light: 1.5, dark: 0, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 0 },
  },
  {
    name: "ダグジャガルマ",
    id: "daguja",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 874, MP: 388, atk: 384, def: 644, spd: 298, int: 522 },
    initialSkill: ["クラックストーム", "属性断罪の刻印", "光のはどう", "ザオリク"],
    defaultGear: "lightCharm",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        defUp: { strength: 1 },
        slashBarrier: { strength: 1 },
        mindBarrier: { keepOnDeath: true },
        confusedBreak: { keepOnDeath: true, strength: 2 },
      },
      evenTurnBuffs: {
        defUp: { strength: 1 },
        slashBarrier: { strength: 1 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.15, def: 1.15 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 1, thunder: 1, wind: 1, io: 1, light: 1, dark: 1, poisoned: 0.5, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 0, spellSeal: 0, breathSeal: 0 },
  },
  {
    name: "闇の大魔王ゾーマ", //44 全ステ20 スキルライン: HP50 def100込み
    id: "zoma",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 794, MP: 404, atk: 518, def: 632, spd: 502, int: 560 },
    initialSkill: ["サイコストーム", "絶対零度", "真・いてつくはどう", "ザオリク"],
    defaultGear: "zomaRobe",
    attribute: {
      initialBuffs: {
        demonKingBarrier: { divineDispellable: true },
        protection: { strength: 0.3, duration: 3 },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0.5, ice: 0, thunder: 1, wind: 1, io: 0.5, light: 0, dark: 0.5, poisoned: 1, asleep: 0.5, confused: 0, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "竜王", //44 スキルライン: HP100 atk50込み
    id: "ryuou",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 925, MP: 503, atk: 631, def: 445, spd: 425, int: 479 },
    initialSkill: ["くいちぎる", "咆哮", "スパークふんしゃ", "防刃の守り"],
    initialAIDisabledSkills: ["くいちぎる"],
    defaultGear: "dragonCaneWithoutSpd",
    attribute: {
      initialBuffs: {
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
        demonKingBarrier: { divineDispellable: true },
        protection: { strength: 0.3, duration: 3 },
      },
      permanentBuffs: {
        powerCharge: { strength: 1.2 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 0.5, thunder: 1, wind: 1, io: -1, light: 0, dark: 0.5, poisoned: 1, asleep: 0.5, confused: 0.5, paralyzed: 0.5, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "かみさま", //多分4
    id: "god",
    rank: 10,
    race: ["???"],
    weight: 27,
    status: { HP: 763, MP: 397, atk: 389, def: 522, spd: 389, int: 498 },
    initialSkill: ["天界の守り", "神のはどう", "ザオリーマ", "ザオリク"],
    anotherSkills: ["ステテコダンス"],
    defaultGear: "kudaki",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        healEnhancement: { keepOnDeath: true },
        demonKingBarrier: { divineDispellable: true },
        protection: { strength: 0.34, duration: 3 },
        revive: { keepOnDeath: true, divineDispellable: true, strength: 1 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.2, spd: 1.08 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0.5, ice: 0.5, thunder: 0.5, wind: 1, io: 1, light: -1, dark: 1, poisoned: 1, asleep: 0.5, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 1.5, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "聖地竜オリハルゴン", //44
    id: "oriharu",
    rank: 10,
    race: ["ドラゴン"],
    weight: 27,
    status: { HP: 820, MP: 324, atk: 558, def: 560, spd: 392, int: 307 },
    initialSkill: ["地殻変動", "アストロン", "テンペストブレス", "天の裁き"],
    initialAIDisabledSkills: ["地殻変動", "天の裁き"],
    anotherSkills: ["大地の守り"],
    defaultGear: "familyNailRadiantWave",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.75, isMetal: true },
        mpCostMultiplier: { strength: 1.2, keepOnDeath: true },
        baiki: { strength: 2 },
        mindBarrier: { keepOnDeath: true },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.2 },
    lsTarget: "all",
    resistance: { fire: 0, ice: 0.5, thunder: 0.5, wind: 1, io: 1, light: 0, dark: 1, poisoned: 1.5, asleep: 1, confused: 1, paralyzed: 0.5, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "パラディノス", //最強
    id: "paradhi",
    rank: 9,
    race: ["ドラゴン"],
    weight: 14,
    status: { HP: 704, MP: 260, atk: 499, def: 481, spd: 237, int: 226 },
    initialSkill: ["超魔神斬り", "聖騎士の守護", "スパークふんしゃ", "防刃の守り"],
    defaultGear: "kanazuchi",
    attribute: {},
    seed: { atk: 95, def: 25, spd: 0, int: 0 },
    ls: { atk: 1.1, def: 1.1 },
    lsTarget: "ドラゴン",
    resistance: { fire: 0.5, ice: 1, thunder: 0, wind: 0.5, io: 0, light: 0, dark: 1, poisoned: 1.5, asleep: 0.5, confused: 0, paralyzed: 1, zaki: 0.5, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ミステリドール",
    id: "dogu",
    rank: 9,
    race: ["物質"],
    weight: 16,
    status: { HP: 854, MP: 305, atk: 568, def: 588, spd: 215, int: 358 },
    initialSkill: ["アストロンゼロ", "衝撃波", "みがわり", "防刃の守り"],
    defaultGear: "familyNail",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        mindBarrier: { duration: 3 },
      },
      2: {
        defUp: { strength: 1 },
        spellBarrier: { strength: 1 },
        breathBarrier: { strength: 1 },
      },
      permanentBuffs: {
        anchorAction: {},
      },
    },
    seed: { atk: 40, def: 80, spd: 0, int: 0 },
    ls: { HP: 1.15 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 1, thunder: 0, wind: 1.5, io: 0, light: 1.5, dark: 1, poisoned: 0, asleep: 0, confused: 0.5, paralyzed: 0.5, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "闇魔ティトス",
    id: "dorunisu",
    rank: 9,
    race: ["???"],
    weight: 14,
    status: { HP: 837, MP: 236, atk: 250, def: 485, spd: 303, int: 290 },
    initialSkill: ["おおいかくす", "闇の紋章", "防刃の守り", "タップダンス"],
    defaultGear: "dragonScale",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.75, isMetal: true },
        mpCostMultiplier: { strength: 1.2, keepOnDeath: true },
        elementalShield: { targetElement: "dark", remain: 250, unDispellable: true, targetType: "ally", iconSrc: "elementalShieldDark" },
        damageLimit: { unDispellable: true, strength: 250 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 1, thunder: 1, wind: 1, io: 1, light: 1, dark: 0, poisoned: 1, asleep: 0.5, confused: 0.5, paralyzed: 0.5, zaki: 1, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "氷魔フィルグレア",
    id: "hyadonisu",
    rank: 9,
    race: ["???"],
    weight: 14,
    status: { HP: 837, MP: 236, atk: 250, def: 485, spd: 303, int: 290 },
    initialSkill: ["おおいかくす", "氷の紋章", "防刃の守り", "ザオリク"],
    defaultGear: "lightCharm",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.75, isMetal: true },
        mpCostMultiplier: { strength: 1.2, keepOnDeath: true },
        elementalShield: { targetElement: "ice", remain: 250, unDispellable: true, targetType: "ally", iconSrc: "elementalShieldIce" },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 0, thunder: 1, wind: 1, io: 1, light: 1, dark: 1, poisoned: 1, asleep: 0.5, confused: 0.5, paralyzed: 0.5, zaki: 1, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "宵闇の魔人",
    id: "yoiyami",
    rank: 9,
    race: ["物質"],
    weight: 14,
    status: { HP: 864, MP: 264, atk: 367, def: 589, spd: 305, int: 170 },
    initialSkill: ["封印の光", "におうだち", "ザオリク", "防刃の守り"],
    anotherSkills: ["息よそく"],
    defaultGear: "familyNail",
    defaultAiType: "いのちだいじに",
    attribute: {},
    seed: { atk: 30, def: 80, spd: 10, int: 0 },
    ls: { HP: 1.15 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 1, thunder: 1, wind: 1, io: 1, light: 1, dark: -1, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "タイタニス",
    id: "tanisu",
    rank: 10,
    race: ["悪魔"],
    weight: 30,
    status: { HP: 772, MP: 458, atk: 329, def: 495, spd: 462, int: 501 },
    initialSkill: ["邪悪なこだま", "絶氷の嵐", "禁忌のかくせい", "邪道のかくせい"],
    anotherSkills: ["呪縛の氷撃", "バギムーチョ"],
    attribute: {
      initialBuffs: {
        iceBreak: { keepOnDeath: true, strength: 1 },
        mindAndSealBarrier: { keepOnDeath: true },
        protection: { strength: 0.5, duration: 3 },
      },
    },
    seed: { atk: 0, def: 0, spd: 75, int: 45 },
    ls: { HP: 1.3, spd: 1.25 },
    lsTarget: "悪魔",
    resistance: { fire: 1, ice: 0, thunder: 0.5, wind: 0.5, io: 0.5, light: 1, dark: 0, poisoned: 0.5, asleep: 0, confused: 0.5, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "デュラン",
    id: "dhuran",
    rank: 10,
    race: ["悪魔"],
    weight: 28,
    status: { HP: 845, MP: 315, atk: 689, def: 502, spd: 483, int: 255 },
    initialSkill: ["無双のつるぎ", "瞬撃", "昇天斬り", "光のはどう"],
    anotherSkills: ["滅竜の絶技", "誇りのつるぎ"],
    defaultGear: "shoten",
    attribute: {
      initialBuffs: {
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
      },
      evenTurnBuffs: {
        powerCharge: { strength: 2 },
      },
    },
    seed: { atk: 35, def: 0, spd: 85, int: 0 },
    ls: { atk: 1.12, spd: 1.18 },
    lsTarget: "悪魔",
    AINormalAttack: [2, 3],
    resistance: { fire: 1, ice: 1, thunder: 0, wind: 0.5, io: 1, light: 0.5, dark: 0, poisoned: 1, asleep: 0, confused: 0, paralyzed: 1, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ディアロゴス",
    id: "rogos",
    rank: 10,
    race: ["悪魔"],
    weight: 32,
    status: { HP: 823, MP: 314, atk: 504, def: 383, spd: 486, int: 535 },
    initialSkill: ["カタストロフ", "らいてい弾", "ラストストーム", "イオナルーン"],
    initialAIDisabledSkills: ["イオナルーン"],
    anotherSkills: ["陰惨な暗闇"],
    defaultGear: "familyNail",
    attribute: {
      initialBuffs: {
        thunderBreak: { keepOnDeath: true, strength: 2 },
        windBreak: { keepOnDeath: true, strength: 2 },
        darkBreak: { keepOnDeath: true, strength: 2 },
      },
      evenTurnBuffs: {
        thunderBreakBoost: { strength: 1, maxStrength: 3 },
        windBreakBoost: { strength: 1, maxStrength: 3 },
        darkBreakBoost: { strength: 1, maxStrength: 3 },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1.15, spd: 1.15 },
    lsTarget: "悪魔",
    AINormalAttack: [2, 3],
    resistance: { fire: 1, ice: 0, thunder: 0, wind: 0, io: 1, light: 1, dark: -1, poisoned: 1, asleep: 0.5, confused: 0.5, paralyzed: 0.5, zaki: 0, dazzle: 0, spellSeal: 0.5, breathSeal: 1 },
  },
  {
    name: "涼風の魔女グレイツェル",
    id: "tseru",
    rank: 10,
    race: ["悪魔"],
    weight: 25,
    status: { HP: 852, MP: 314, atk: 258, def: 422, spd: 519, int: 503 },
    initialSkill: ["蠱惑の舞い", "宵の暴風", "悪魔の息見切り", "スパークふんしゃ"],
    anotherSkills: ["妖艶イオマータ"],
    defaultGear: "swimSuit",
    attribute: {
      initialBuffs: {
        windBreak: { keepOnDeath: true, strength: 1 },
      },
      permanentBuffs: {
        mindAndSealBarrier: { divineDispellable: true, duration: 3, probability: 0.25 },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { spd: 1.2 },
    lsTarget: "悪魔",
    resistance: { fire: 0.5, ice: 0, thunder: 1, wind: 0, io: 1, light: 0.5, dark: 0.5, poisoned: 0.5, asleep: 1, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "魔性の道化ドルマゲス",
    id: "magesu",
    rank: 10,
    race: ["悪魔"],
    weight: 25,
    status: { HP: 743, MP: 379, atk: 470, def: 421, spd: 506, int: 483 },
    initialSkill: ["秘術イオマータ", "狂気のいあつ", "マインドバリア", "あんこくのはばたき"],
    anotherSkills: ["絶望の爆炎"],
    defaultGear: "devilSpdHeart",
    attribute: {
      initialBuffs: {
        spdUp: { strength: 2 },
      },
      evenTurnBuffs: {
        manaBoost: { strength: 1.5 },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { spd: 1.18 },
    lsTarget: "悪魔",
    resistance: { fire: 1, ice: 0.5, thunder: 0.5, wind: 1, io: 1, light: 0.5, dark: 0, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "幻惑のムドー",
    id: "mudo",
    rank: 10,
    race: ["悪魔"],
    weight: 28,
    status: { HP: 799, MP: 408, atk: 260, def: 589, spd: 435, int: 492 },
    initialSkill: ["催眠の邪弾", "夢の世界", "ギラマータ", "幻術のひとみ"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        thunderBreak: { keepOnDeath: true, strength: 1 },
        asleepBreak: { keepOnDeath: true, strength: 1 },
        mindBarrier: { keepOnDeath: true },
      },
      evenTurnBuffs: { defUp: { strength: 1 }, slashBarrier: { strength: 1 } },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1.15, def: 1.15 },
    lsTarget: "all",
    resistance: { fire: 0.5, ice: 0, thunder: 1, wind: 0.5, io: 0, light: 1, dark: 1, poisoned: 1, asleep: 0, confused: 0, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 0.5, breathSeal: 1 },
  },
  {
    name: "ズイカク&ショウカク",
    id: "zuisho",
    rank: 10,
    race: ["悪魔"],
    weight: 25,
    status: { HP: 844, MP: 328, atk: 502, def: 613, spd: 399, int: 158 },
    initialSkill: ["におうだち", "だいぼうぎょ", "昇天斬り", "精霊の守り・強"],
    anotherSkills: ["みがわり", "会心撃"],
    defaultGear: "heavenlyClothes",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.75, isMetal: true },
        mpCostMultiplier: { strength: 1.2, keepOnDeath: true },
        breathReflection: { strength: 1, keepOnDeath: true },
      },
    },
    seed: { atk: 55, def: 0, spd: 65, int: 0 },
    ls: { HP: 1.3 },
    lsTarget: "悪魔",
    AINormalAttack: [2],
    resistance: { fire: 1, ice: 1, thunder: 0.5, wind: 0.5, io: 0.5, light: 0.5, dark: 0, poisoned: 0.5, asleep: 0.5, confused: 1.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ジャハガロス",
    id: "jaha",
    rank: 10,
    race: ["悪魔"],
    weight: 28,
    status: { HP: 810, MP: 403, atk: 256, def: 588, spd: 445, int: 483 },
    initialSkill: ["巨岩投げ", "苛烈な暴風", "魔の忠臣", "精霊の守り・強"],
    anotherSkills: ["超息よそく"],
    defaultGear: "heavenlyClothes",
    attribute: {
      initialBuffs: {
        protection: { strength: 0.34, duration: 3 },
        intUp: { strength: 1 },
        revive: { keepOnDeath: true, divineDispellable: true, strength: 1, act: "復讐の闘志" },
        spellBarrier: { strength: 2 },
      },
      evenTurnBuffs: { defUp: { strength: 1 }, intUp: { strength: 1 } },
    },
    seed: { atk: 30, def: 55, spd: 35, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 0.5, thunder: 1, wind: 0, io: 0.5, light: 1, dark: 0, poisoned: 0.5, asleep: 0, confused: 1, paralyzed: 0.5, zaki: 0, dazzle: 1, spellSeal: 0.5, breathSeal: 1 },
  },
  {
    name: "リーズレット",
    id: "rizu",
    rank: 10,
    race: ["悪魔"],
    weight: 25,
    status: { HP: 780, MP: 375, atk: 326, def: 398, spd: 492, int: 509 },
    initialSkill: ["フローズンスペル", "氷の王国", "雪だるま", "メゾラゴン"],
    defaultGear: "devilSpdHeart",
    attribute: {
      initialBuffs: {
        breathReflection: { keepOnDeath: true, strength: 1 },
        dodgeBuff: { keepOnDeath: true, strength: 0.5 },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { spd: 1.15, int: 1.15 },
    lsTarget: "悪魔",
    resistance: { fire: 1, ice: -1, thunder: 1, wind: 0, io: 1, light: 0.5, dark: 0.5, poisoned: 1, asleep: 1, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "イブール", //4
    id: "iburu",
    rank: 10,
    race: ["悪魔"],
    weight: 28,
    status: { HP: 815, MP: 414, atk: 292, def: 511, spd: 449, int: 496 },
    initialSkill: ["イオナスペル", "神のはどう", "イブールの誘い", "メゾラゴン"],
    anotherSkills: ["悪夢の雷鳴"],
    defaultGear: "devilSpdHeart",
    attribute: {
      initialBuffs: {
        breathEvasion: { duration: 3, divineDispellable: true },
      },
      evenTurnBuffs: { defUp: { strength: 1 }, intUp: { strength: 1 } },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1.15, int: 1.15 },
    lsTarget: "悪魔",
    resistance: { fire: 0.5, ice: -1, thunder: 1, wind: 0.5, io: 1, light: 1.5, dark: 0.5, poisoned: 1, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "新生イブール", //4 S+50
    id: "iburuNew",
    rank: 10,
    race: ["悪魔"],
    weight: 28,
    status: { HP: 815, MP: 414, atk: 292, def: 511, spd: 499, int: 496 },
    initialSkill: ["光速イオナスペル", "教祖のはどう", "スパークふんしゃ", "タップダンス"],
    anotherSkills: ["イオナスペル", "神のはどう", "イブールの誘い", "悪夢の雷鳴"],
    defaultGear: "devilSpdHeart",
    attribute: {
      initialBuffs: {
        breathEvasion: { duration: 3, divineDispellable: true },
        allElementalBoost: { strength: 0.2, duration: 4 },
      },
      evenTurnBuffs: { defUp: { strength: 1 }, intUp: { strength: 1 } },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1.15, int: 1.15 },
    lsTarget: "悪魔",
    resistance: { fire: 0.5, ice: -1, thunder: 1, wind: 0.5, io: 1, light: 1.5, dark: 0.5, poisoned: 1, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "妖魔軍王ブギー", //4
    id: "boogie",
    rank: 10,
    race: ["悪魔"],
    weight: 28,
    status: { HP: 810, MP: 382, atk: 389, def: 499, spd: 438, int: 466 },
    initialSkill: ["ブギウギステップ", "ひれつなさくせん", "スパークふんしゃ", "ギガ・マホトラ"],
    anotherSkills: ["たつまき"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        mindBarrier: { keepOnDeath: true },
        spellReflection: { strength: 1, duration: 4, decreaseTurnEnd: true },
        spdUp: { strength: 2 },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 1, ice: 0.5, thunder: 1, wind: 0, io: 1, light: 1.5, dark: -1, poisoned: 0.5, asleep: 0.5, confused: 0, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "フォロボシータ", //最強 (最強増分213022)
    id: "sita",
    rank: 10,
    race: ["悪魔"],
    weight: 27,
    status: { HP: 840, MP: 484, atk: 354, def: 364, spd: 395, int: 501 },
    initialSkill: ["メガントマータ", "ばくえんの秘術", "呪縛の氷撃", "サイコバースト"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.5 },
        mpCostMultiplier: { strength: 2, keepOnDeath: true },
        iceBreak: { keepOnDeath: true, strength: 1 },
        ioBreak: { keepOnDeath: true, strength: 1 },
        breathReflection: { keepOnDeath: true, strength: 1 },
        manaBoost: { strength: 2 },
      },
      evenTurnBuffs: { defUp: { strength: 1 }, intUp: { strength: 1 } },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1.4 },
    lsTarget: "悪魔",
    resistance: { fire: 1.5, ice: 0, thunder: 1, wind: 1, io: 1, light: 1.5, dark: 0, poisoned: 1, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "凶ライオネック",
    id: "raio",
    rank: 10,
    race: ["悪魔"],
    weight: 25,
    status: { HP: 740, MP: 375, atk: 397, def: 380, spd: 480, int: 498 },
    initialSkill: ["マガデイン", "メラゾロス", "イオナルーン", "キャンセルステップ"],
    anotherSkills: ["けがれた狂風", "マインドブレス"],
    defaultGear: "windCane",
    attribute: {
      initialBuffs: {
        windBreak: { keepOnDeath: true, strength: 2 },
        manaBoost: { strength: 1.2 },
        dodgeBuff: { strength: 1 },
        crimsonMist: { strength: 0.1, removeAtTurnStart: true, duration: 1 },
      },
      1: {
        preemptiveAction: {},
      },
    },
    seed: { atk: 0, def: 0, spd: 55, int: 65 },
    ls: { spd: 1.18 },
    lsTarget: "悪魔",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 1, thunder: 1, wind: 0, io: 1, light: 0.5, dark: 1, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 0.5, breathSeal: 1 },
  },
  {
    name: "ビッグフェイス", //多分44
    id: "bigface",
    rank: 8,
    race: ["悪魔"],
    weight: 8,
    status: { HP: 550, MP: 211, atk: 464, def: 491, spd: 351, int: 234 },
    initialSkill: ["はやぶさ斬り", "みがわり", "精霊の守り・強", "マインドバリア"],
    defaultGear: "lightCharm",
    attribute: {},
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { def: 1.1 },
    lsTarget: "all",
    resistance: { fire: 0.5, ice: 0.5, thunder: 1, wind: 0.5, io: 1, light: 1, dark: 1, poisoned: 0, asleep: 1, confused: 0.5, paralyzed: 1.5, zaki: 1, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "キングアズライル",
    id: "azu",
    rank: 10,
    race: ["魔獣"],
    weight: 30,
    status: { HP: 967, MP: 293, atk: 267, def: 531, spd: 534, int: 419 },
    initialSkill: ["ヘブンリーブレス", "裁きの極光", "昇天斬り", "光のはどう"],
    anotherSkills: ["黄金の息吹"],
    defaultGear: "cursedNail",
    attribute: {
      initialBuffs: {
        breathReflection: { strength: 1, keepOnDeath: true },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { spd: 1.45 },
    lsTarget: "魔獣",
    AINormalAttack: [2],
    resistance: { fire: 1, ice: 0, thunder: 1, wind: 0.5, io: 1, light: 0, dark: 1, poisoned: 0.5, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 0 },
  },
  {
    name: "ヘルゴラゴ",
    id: "gorago",
    rank: 10,
    race: ["魔獣"],
    weight: 30,
    status: { HP: 692, MP: 406, atk: 609, def: 455, spd: 577, int: 366 },
    initialSkill: ["獣王の猛撃", "波状裂き", "スパークふんしゃ", "キャンセルステップ"],
    initialAIDisabledSkills: ["波状裂き"],
    anotherSkills: ["ハリケーン"],
    defaultGear: "familyNailBeast",
    attribute: {
      initialBuffs: {
        mindBarrier: { keepOnDeath: true },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { atk: 1.1, spd: 1.3 },
    lsTarget: "魔獣",
    AINormalAttack: [2, 3],
    resistance: { fire: 0.5, ice: 0.5, thunder: 1, wind: 0.5, io: 0.5, light: 1, dark: 0.5, poisoned: 0, asleep: 1, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "てんかいじゅう",
    id: "tenkai",
    rank: 10,
    race: ["魔獣"],
    weight: 28,
    status: { HP: 865, MP: 396, atk: 506, def: 428, spd: 513, int: 275 },
    initialSkill: ["ツイスター", "浄化の風", "天翔の舞い", "タップダンス"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        breathEnhancement: { keepOnDeath: true },
        windBreak: { keepOnDeath: true, strength: 1 },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 1, ice: 1, thunder: 0.5, wind: 0.5, io: 1, light: 0, dark: 0, poisoned: 1, asleep: 1, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "魔犬レオパルド",
    id: "reopa",
    rank: 10,
    race: ["魔獣"],
    weight: 28,
    status: { HP: 791, MP: 333, atk: 590, def: 436, spd: 533, int: 295 },
    initialSkill: ["狂乱のやつざき", "火葬のツメ", "暗黒の誘い", "スパークふんしゃ"],
    anotherSkills: ["いてつくはどう"],
    defaultGear: "kanazuchi",
    attribute: {
      initialBuffs: {
        isUnbreakable: { keepOnDeath: true, name: "くじけぬ心" },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 1, ice: 0.5, thunder: 1, wind: 0.5, io: 1, light: 1.5, dark: -1, poisoned: 1, asleep: 0, confused: 0, paralyzed: 1, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "百獣の王キングレオ",
    id: "kingreo",
    rank: 10,
    race: ["魔獣"],
    weight: 28,
    status: { HP: 780, MP: 305, atk: 579, def: 530, spd: 487, int: 309 },
    initialSkill: ["ビーストアイ", "無慈悲なきりさき", "スパークふんしゃ", "防刃の守り"],
    anotherSkills: ["超こうねつガス", "昇天のこぶし"],
    defaultGear: "hunkiNail",
    attribute: {
      initialBuffs: {
        baiki: { strength: 2, keepOnDeath: true },
        spdUp: { strength: 2 },
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
      },
      evenTurnBuffs: { defUp: { strength: 1 }, spdUp: { strength: 1 }, breathBarrier: { strength: 1 } },
    },
    seed: { atk: 85, def: 0, spd: 35, int: 0 },
    ls: { HP: 1.18, atk: 1.15 },
    lsTarget: "魔獣",
    AINormalAttack: [2, 3],
    resistance: { fire: 0.5, ice: 1, thunder: -1, wind: 0.5, io: 0, light: 1.5, dark: 1, poisoned: 0.5, asleep: 1, confused: 0.5, paralyzed: 0.5, zaki: 0.5, dazzle: 0, spellSeal: 1, breathSeal: 0.5 },
  },
  {
    name: "極彩鳥にじくじゃく", //4
    id: "nijiku",
    rank: 10,
    race: ["魔獣"],
    weight: 28,
    status: { HP: 862, MP: 289, atk: 316, def: 523, spd: 515, int: 473 },
    initialSkill: ["レインマダンテ", "かえんりゅう", "天雷の息吹", "防刃の守り"],
    anotherSkills: ["極彩鳥のはどう"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        fireBreak: { keepOnDeath: true, strength: 2 },
      },
    },
    seed: { atk: 0, def: 10, spd: 80, int: 30 },
    ls: { HP: 1.2, MP: 1.2 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 0.5, thunder: 0, wind: 1, io: 1, light: 0.5, dark: 0.5, poisoned: 0.5, asleep: 1, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 0.5 },
  },
  {
    name: "ドラ猫親分ドラジ",
    id: "doraji",
    rank: 10,
    race: ["魔獣"],
    weight: 25,
    status: { HP: 745, MP: 291, atk: 593, def: 444, spd: 541, int: 256 },
    initialSkill: ["抜刀魔獣刃", "閃く短刀", "スパークふんしゃ", "防刃の守り"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        baiki: { strength: 2 },
      },
      permanentBuffs: {
        mindAndSealBarrier: { divineDispellable: true, duration: 3, probability: 0.25 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1.15, atk: 1.15 },
    lsTarget: "魔獣",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 1.5, thunder: 0, wind: 1, io: 0.5, light: 0.5, dark: 1, poisoned: 1, asleep: 1, confused: 0, paralyzed: 0, zaki: 0.5, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "獣王クロコダイン", //44 新生HP+50
    id: "skuroko",
    rank: 9,
    race: ["魔獣"],
    weight: 14,
    status: { HP: 802, MP: 252, atk: 454, def: 506, spd: 345, int: 222 },
    initialSkill: ["かばう", "ザオリク", "防刃の守り", "いやしの光"],
    defaultGear: "lightCharm",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        isUnbreakable: { keepOnDeath: true, left: 3, isToukon: true, name: "とうこん" },
        slashBarrier: { strength: 1 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.18, atk: 1.03 },
    lsTarget: "魔獣",
    resistance: { fire: 0, ice: 1.5, thunder: 0.5, wind: 0, io: 1, light: 0.5, dark: 1, poisoned: 0.5, asleep: 1, confused: 1, paralyzed: 0, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "アントベア",
    id: "antbear",
    rank: 8,
    race: ["魔獣"],
    weight: 8,
    status: { HP: 550, MP: 151, atk: 522, def: 234, spd: 495, int: 108 },
    initialSkill: ["ラピッドショット", "しっぷうづき", "スパークふんしゃ", "防刃の守り"],
    defaultGear: "ryujinNail",
    attribute: {},
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { spd: 1.1 },
    lsTarget: "魔獣",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 1.5, thunder: 1, wind: 0.5, io: 1, light: 1, dark: 1, poisoned: 1, asleep: 1, confused: 0.5, paralyzed: 0.5, zaki: 1, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "メタルゴッデス", //44
    id: "goddess",
    rank: 10,
    race: ["スライム"],
    weight: 30,
    status: { HP: 208, MP: 490, atk: 601, def: 775, spd: 461, int: 492 },
    initialSkill: ["クアトロマダンテ", "アイアンスラッシュ", "ベホマラー", "ザオリク"],
    anotherSkills: ["女神のはばたき"],
    defaultGear: "slimeHeart",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.25, isMetal: true },
        mpCostMultiplier: { strength: 2.5, keepOnDeath: true },
        mindBarrier: { duration: 3 },
      },
    },
    seed: { atk: 40, def: 5, spd: 75, int: 0 },
    ls: { HP: 1.2, def: 1.2, spd: 1.2 },
    lsTarget: "スライム",
    resistance: { fire: 0, ice: 0, thunder: 0, wind: 0, io: 0, light: 0, dark: 0, poisoned: 0, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "スライダーヒーロー", //4
    id: "surahero",
    rank: 10,
    race: ["スライム"],
    weight: 28,
    status: { HP: 721, MP: 281, atk: 421, def: 649, spd: 510, int: 381 },
    initialSkill: ["アイアンロンド", "ヒーロースパーク", "神のはどう", "息よそく"],
    anotherSkills: ["スキルターン"],
    defaultGear: "familyNailSlime",
    attribute: {
      initialBuffs: {
        lightBreak: { keepOnDeath: true, strength: 2 },
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { atk: 1.15, def: 1.15 },
    lsTarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 0.5, thunder: 0.5, wind: 1, io: -1, light: 0, dark: 1, poisoned: 1.5, asleep: 0, confused: 1, paralyzed: 0.5, zaki: 0.5, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "スライダーガール", //4
    id: "suragirl",
    rank: 10,
    race: ["スライム"],
    weight: 28,
    status: { HP: 758, MP: 287, atk: 538, def: 615, spd: 494, int: 275 },
    initialSkill: ["ばくれつドライブ", "スパークふんしゃ", "カオスストーム", "息よそく"],
    anotherSkills: ["ミラーステップ"],
    defaultGear: "kudaki",
    attribute: {
      initialBuffs: {
        ioBreak: { keepOnDeath: true, strength: 1 },
        thunderBreak: { keepOnDeath: true, strength: 1 },
        damageLimit: { keepOnDeath: true, strength: 250, iconSrc: "none" },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { spd: 1.2 },
    lsTarget: "スライム",
    AINormalAttack: [2, 3],
    resistance: { fire: 1, ice: 1, thunder: -1, wind: 0.5, io: 0, light: 0, dark: 1.5, poisoned: 1.5, asleep: 1, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "スラ・ブラスター", //4
    id: "surabura",
    rank: 10,
    race: ["スライム"],
    weight: 28,
    status: { HP: 796, MP: 434, atk: 368, def: 608, spd: 468, int: 315 },
    initialSkill: ["S・ブラスター", "インパクトキャノン", "ザオリク", "アイアンゲイザー"],
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.33, isMetal: true },
        mpCostMultiplier: { strength: 2, keepOnDeath: true },
        ioBreak: { keepOnDeath: true, strength: 1 },
      },
    },
    seed: { atk: 20, def: 5, spd: 95, int: 0 },
    ls: { HP: 1.3 },
    lsTarget: "スライム",
    resistance: { fire: 0, ice: 0, thunder: 0, wind: 1, io: 1, light: 0.5, dark: 1, poisoned: 0, asleep: 0, confused: 0, paralyzed: 0, zaki: 0.5, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "はぐれロイヤルキング", //44 +HP50
    id: "haguki",
    rank: 10,
    race: ["スライム"],
    weight: 30,
    status: { HP: 298, MP: 521, atk: 325, def: 889, spd: 502, int: 542 },
    initialSkill: ["キングストーム", "メタ・マダンテ", "ベホマラー", "ダメージバリア"],
    anotherSkills: ["ブレードターン", "苛烈な暴風", "みがわり"],
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.25, isMetal: true },
        mpCostMultiplier: { strength: 2.5, keepOnDeath: true },
      },
    },
    seed: { atk: 40, def: 5, spd: 75, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 0, ice: 0, thunder: 0, wind: 0, io: 0, light: 0, dark: 0, poisoned: 0, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ドラゴメタル", //最強 HP100
    id: "dorameta",
    rank: 9,
    race: ["スライム"],
    weight: 16,
    status: { HP: 648, MP: 318, atk: 413, def: 619, spd: 466, int: 412 },
    initialSkill: ["チアフルダンス", "みがわり", "光のはどう", "ザオリク"],
    defaultGear: "slimeHeart",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.75, isMetal: true },
        mpCostMultiplier: { strength: 1.2, keepOnDeath: true },
        revive: { keepOnDeath: true, strength: 0.5 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 0, ice: 0, thunder: 0, wind: 0, io: 0, light: 0, dark: 0, poisoned: 0, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "スラキャンサー", //4?? HP50防御50
    id: "surakyan",
    rank: 9,
    race: ["スライム"],
    weight: 14,
    status: { HP: 674, MP: 207, atk: 350, def: 563, spd: 383, int: 275 },
    initialSkill: ["におうだち", "みがわり", "精霊の守り・強", "マインドバリア"],
    defaultGear: "thunderCharm",
    defaultAiType: "いのちだいじに",
    attribute: {
      permanentBuffs: {
        mindBarrier: { duration: 3, probability: 0.25 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 0.5, ice: 0.5, thunder: 0.5, wind: 1, io: 0.5, light: 0, dark: 1, poisoned: 0, asleep: 0, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ボーグ", //最強??
    id: "bogu",
    rank: 8,
    race: ["スライム"],
    weight: 8,
    status: { HP: 591, MP: 251, atk: 226, def: 477, spd: 353, int: 304 },
    initialSkill: ["やいばのまもり", "みがわり", "防刃の守り", "タップダンス"],
    defaultGear: "familyNail",
    defaultAiType: "いのちだいじに",
    attribute: {
      1: {
        slashReflection: { strength: 1.5, duration: 1, removeAtTurnStart: true, unDispellable: true, dispellableByAbnormality: true },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 1, thunder: 0.5, wind: 1.5, io: 1, light: 1, dark: 1, poisoned: 0.5, asleep: 0.5, confused: 1, paralyzed: 1, zaki: 1, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ダークマター", //44
    id: "matter",
    rank: 10,
    race: ["物質"],
    weight: 30,
    status: { HP: 913, MP: 307, atk: 394, def: 516, spd: 478, int: 406 },
    initialSkill: ["オーバーホール", "グレネードボム", "防衛指令", "リーサルウェポン"],
    anotherSkills: ["アイアンクロー"],
    defaultGear: "familyNail",
    attribute: {
      initialBuffs: {
        ioBreak: { keepOnDeath: true, strength: 2 },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1.6, spd: 1.15 },
    lsTarget: "物質",
    AINormalAttack: [2, 3],
    resistance: { fire: 0.5, ice: 0.5, thunder: 1, wind: 0.5, io: 0.5, light: 1, dark: 0.5, poisoned: 0, asleep: 1, confused: 1, paralyzed: 1, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ファイナルウェポン", //44
    id: "weapon",
    rank: 10,
    race: ["物質"],
    weight: 30,
    status: { HP: 797, MP: 308, atk: 691, def: 431, spd: 492, int: 309 },
    initialSkill: ["羅刹斬", "デッドリースパーク", "破滅プロトコル", "スパークふんしゃ"],
    anotherSkills: ["一刀両断"],
    defaultGear: "kudaki",
    attribute: {
      initialBuffs: {
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { atk: 1.25, spd: 1.15 },
    lsTarget: "物質",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 0.5, thunder: 0.5, wind: 1, io: 1, light: 0, dark: 1, poisoned: 0, asleep: 0, confused: 1, paralyzed: 0.5, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "魂の継承者ヒム", //4
    id: "him",
    rank: 10,
    race: ["物質"],
    weight: 25,
    status: { HP: 650, MP: 247, atk: 601, def: 573, spd: 504, int: 234 },
    initialSkill: ["真・闘気拳", "真・グランドクルス", "スパークふんしゃ", "息よそく"],
    anotherSkills: ["ぶちのめす"],
    defaultGear: "hunkiNail",
    attribute: {
      initialBuffs: {
        fireBreak: { keepOnDeath: true, strength: 1 },
        mindBarrier: { duration: 3 },
      },
      2: {
        preemptiveAction: {}, //昇格の証
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 0, ice: 1, thunder: 1, wind: 1, io: 1, light: 0, dark: 1, poisoned: 0, asleep: 0, confused: 1.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ヘルクラウド", //4
    id: "castle",
    rank: 10,
    race: ["物質"],
    weight: 28,
    status: { HP: 864, MP: 340, atk: 216, def: 620, spd: 462, int: 483 },
    initialSkill: ["ろうじょうのかまえ", "報復の大嵐", "スパークプレス", "苛烈な暴風"],
    defaultGear: "waveNail",
    attribute: {
      initialBuffs: {
        windBreak: { keepOnDeath: true, strength: 1 },
        dodgeBuff: { strength: 1, duration: 99 },
        mindBarrier: { keepOnDeath: true },
        spdUp: { strength: 2 },
      },
      2: {
        intUp: { strength: 2 },
      },
      3: {
        manaBoost: { strength: 2 },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1.2 },
    lsTarget: "物質",
    resistance: { fire: 0.5, ice: 0.5, thunder: 1, wind: 0.5, io: 0.5, light: 0, dark: 1, poisoned: 0, asleep: 0.5, confused: 1, paralyzed: 0.5, zaki: 0, dazzle: 1, spellSeal: 0.5, breathSeal: 1 },
  },
  {
    name: "守護神ゴーレム", //4 HP+200
    id: "golem",
    rank: 10,
    race: ["物質"],
    weight: 28,
    status: { HP: 1130, MP: 256, atk: 458, def: 677, spd: 393, int: 268 },
    initialSkill: ["マテリアルガード", "おおいかくす", "アースクラッシュ", "ザオリク"],
    anotherSkills: ["アンカースパーク", "メルキドの守護神"],
    defaultGear: "heavenlyClothes",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        defUp: { strength: 2, keepOnDeath: true },
      },
    },
    seed: { atk: 0, def: 65, spd: 55, int: 0 },
    ls: { atk: 1.2, spd: 0.9 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 0.5, thunder: 1, wind: 1, io: 0.5, light: 0, dark: 1, poisoned: 0, asleep: 1.5, confused: 0, paralyzed: 0, zaki: 0.5, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "キングミミック", //44
    id: "kinmimi",
    rank: 10,
    race: ["物質"],
    weight: 25,
    status: { HP: 744, MP: 280, atk: 568, def: 621, spd: 364, int: 327 },
    initialSkill: ["トラウマトラップ", "アンカーラッシュ", "ギガ・マホヘル", "体砕きの斬舞"],
    defaultGear: "kudaki",
    attribute: {
      initialBuffs: {
        mindBarrier: { keepOnDeath: true },
      },
      permanentBuffs: {
        slashReflection: { strength: 1, duration: 1, unDispellable: true, isKanta: true, dispellableByAbnormality: true },
      },
    },
    seed: { atk: 95, def: 25, spd: 0, int: 0 },
    ls: { HP: 1.25 },
    lsTarget: "物質",
    AINormalAttack: [1, 3],
    resistance: { fire: 0.5, ice: 0.5, thunder: 1, wind: 0, io: 1, light: 1, dark: 0.5, poisoned: 0, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0.5, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ダーティードール", //444 新生全ステ20
    id: "dirtydoll",
    rank: 9,
    race: ["物質"],
    weight: 16,
    status: { HP: 672, MP: 291, atk: 562, def: 536, spd: 526, int: 319 },
    initialSkill: ["オカルトソード", "ダーティーショット", "おぞましいおたけび", "スパークふんしゃ"],
    defaultGear: "ryujinNail",
    attribute: {
      1: {
        dodgeBuff: { strength: 0.5, duration: 3 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { spd: 1.15 },
    lsTarget: "物質",
    AINormalAttack: [2, 3],
    resistance: { fire: 0.5, ice: 1, thunder: 0.5, wind: 1, io: 0.5, light: 1, dark: 0.5, poisoned: 0, asleep: 1, confused: 1.5, paralyzed: 0.5, zaki: 0.5, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "スカルスパイダー",
    id: "skullspider",
    rank: 10,
    race: ["ゾンビ"],
    weight: 30,
    status: { HP: 927, MP: 280, atk: 385, def: 646, spd: 495, int: 283 },
    initialSkill: ["ヴェノムパニック", "ドレッドダンス", "劇毒のきり", "スパークふんしゃ"],
    anotherSkills: ["毒性深化"],
    attribute: {
      initialBuffs: {
        poisonedBreak: { keepOnDeath: true, strength: 2 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { spd: 1.18 },
    lsTarget: "ゾンビ",
    AINormalAttack: [2],
    resistance: { fire: 1, ice: 0, thunder: 1, wind: 0.5, io: 0.5, light: 1, dark: 0, poisoned: 1, asleep: 0.5, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ラザマナス",
    id: "razama",
    rank: 10,
    race: ["ゾンビ"],
    weight: 30,
    status: { HP: 1055, MP: 373, atk: 558, def: 517, spd: 412, int: 253 },
    initialSkill: ["黄金のカギ爪", "紫電の瘴気", "ホラーブレス", "防壁反転"],
    anotherSkills: ["黄泉がえりの舞い"],
    defaultGear: "familyNailBeast",
    attribute: {
      initialBuffs: {
        protection: { strength: 0.5, duration: 3 },
        mindBarrier: { duration: 3 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { spd: 1.18 },
    lsTarget: "ゾンビ",
    AINormalAttack: [2, 3],
    resistance: { fire: 1, ice: 0, thunder: 1, wind: 0.5, io: 0.5, light: 1, dark: 0, poisoned: 0, asleep: 1, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "怨恨の骸バラモスゾンビ",
    id: "barazon",
    rank: 10,
    race: ["ゾンビ"],
    weight: 28,
    status: { HP: 881, MP: 290, atk: 703, def: 311, spd: 393, int: 403 },
    initialSkill: ["ネクロゴンドの衝撃", "イオナフィスト", "ジェノサイドストーム", "漆黒の儀式"],
    initialAIDisabledSkills: ["漆黒の儀式"],
    defaultGear: "kanazuchi",
    attribute: {
      initialBuffs: {
        ioBreak: { keepOnDeath: true, strength: 1 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { atk: 1.2 },
    lsTarget: "ゾンビ",
    AINormalAttack: [2, 3],
    resistance: { fire: 1.5, ice: 1, thunder: 0.5, wind: 1, io: 0, light: 1.5, dark: 0, poisoned: 0, asleep: 1, confused: 0, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "魔炎鳥",
    id: "maen",
    rank: 10,
    race: ["ゾンビ"],
    weight: 28,
    status: { HP: 708, MP: 484, atk: 491, def: 386, spd: 433, int: 487 },
    initialSkill: ["れんごくの翼", "プロミネンス", "時ゆがめる暗霧", "ヴェレマータ"],
    initialAIDisabledSkills: ["れんごくの翼"],
    defaultGear: "pharaohBracelet",
    attribute: {
      initialBuffs: {
        fireBreak: { keepOnDeath: true, strength: 1 },
        darkBreak: { keepOnDeath: true, strength: 1 },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1.3 },
    lsTarget: "ゾンビ",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 1, thunder: 0.5, wind: 1, io: 1, light: 1.5, dark: -1, poisoned: 0, asleep: 0, confused: 1, paralyzed: 0.5, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "くさったまじゅう", //44
    id: "kusamaju",
    rank: 10,
    race: ["ゾンビ"],
    weight: 25,
    status: { HP: 812, MP: 286, atk: 561, def: 283, spd: 531, int: 407 },
    initialSkill: ["ヒートヴェノム", "腐乱の波動", "仁王溶かしの息", "スパークふんしゃ"],
    defaultGear: "metalNail",
    attribute: {
      initialBuffs: {
        fireBreak: { keepOnDeath: true, strength: 1 },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { spd: 1.18 },
    lsTarget: "ゾンビ",
    resistance: { fire: 1.5, ice: 1, thunder: 1, wind: 0.5, io: 1, light: 0.5, dark: 1, poisoned: 0, asleep: 1, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "デスソシスト",
    id: "desuso",
    rank: 10,
    race: ["ゾンビ"],
    weight: 27,
    status: { HP: 812, MP: 304, atk: 393, def: 625, spd: 325, int: 504 },
    initialSkill: ["メガントマータ", "防壁反転", "亡者の儀式", "鮮烈な稲妻"],
    attribute: {
      initialBuffs: {
        isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
        spellBarrier: { strength: 2 },
        mindBarrier: { keepOnDeath: true },
      },
      evenTurnBuffs: { defUp: { strength: 1 }, intUp: { strength: 1 } },
    },
    seed: { atk: 0, def: 65, spd: 0, int: 55 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 1.5, ice: 0.5, thunder: 0, wind: 1, io: 0.5, light: 1, dark: 0, poisoned: 0.5, asleep: 0, confused: 0, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "真・冥王ゴルゴナ", //44 全ステ20
    id: "gorugona",
    rank: 10,
    race: ["ゾンビ"],
    weight: 25,
    status: { HP: 839, MP: 311, atk: 292, def: 643, spd: 384, int: 519 },
    initialSkill: ["冥府の邪法", "六芒魔法陣", "ザオリク", "斬撃よそく"],
    defaultGear: "silverFeather",
    defaultAiType: "いのちだいじに",
    attribute: {},
    seed: { atk: 0, def: 50, spd: 0, int: 70 },
    ls: { atk: 1.2, def: 0.95 },
    lsTarget: "ゾンビ",
    resistance: { fire: 1.5, ice: 1, thunder: 1, wind: 1, io: 1, light: 1.5, dark: 0, poisoned: 0, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "非道兵器超魔ゾンビ", //4
    id: "tyomazombie",
    rank: 10,
    race: ["ゾンビ"],
    weight: 28,
    status: { HP: 869, MP: 265, atk: 638, def: 625, spd: 316, int: 270 },
    initialSkill: ["ボーンスキュル", "超魔改良", "ザオラル", "スパークふんしゃ"],
    defaultGear: "silverFeather",
    defaultAiType: "いのちだいじに",
    attribute: {
      permanentBuffs: {
        anchorAction: { probability: 0.2 },
      },
    },
    seed: { atk: 40, def: 10, spd: 0, int: 70 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 1, ice: 1, thunder: 1, wind: 1, io: 1, light: 1.5, dark: 0, poisoned: 0, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ファラオ・カーメン",
    id: "pharaoh",
    rank: 10,
    race: ["ゾンビ"],
    weight: 25,
    status: { HP: 747, MP: 253, atk: 565, def: 504, spd: 450, int: 225 },
    initialSkill: ["太陽神の鉄槌", "氷獄斬り", "ファラオの幻刃", "ファラオの召喚"],
    attribute: {
      initialBuffs: { pharaohPower: { keepOnDeath: true } },
      evenTurnBuffs: { baiki: { strength: 1 }, spdUp: { strength: 1 }, intUp: { strength: 1 } },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 1, ice: 0, thunder: 1, wind: 1, io: 1, light: 1.5, dark: 0.5, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 0.5, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "邪教の使徒ゲマ", //4 新生S+50
    id: "gema",
    rank: 10,
    race: ["ゾンビ"],
    weight: 28,
    status: { HP: 784, MP: 333, atk: 528, def: 411, spd: 443, int: 528 },
    initialSkill: ["業火のロンド", "非道の儀式", "闇討ちの魔弾", "石化の呪い"],
    anotherSkills: ["メラゾストーム", "死神の大鎌"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        fireBreak: { keepOnDeath: true, strength: 1 },
        mindBarrier: { duration: 3 },
        spellReflection: { divineDispellable: true, strength: 1.5, duration: 3 },
      },
      evenTurnBuffs: { powerCharge: { strength: 1.5 }, manaBoost: { strength: 1.5 } },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1.15 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 0, thunder: 0.5, wind: 0.5, io: 1, light: 1.5, dark: 0, poisoned: 0.5, asleep: 0.5, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "けがれの渦", //最強？
    id: "dokutama",
    rank: 9,
    race: ["ゾンビ"],
    weight: 16,
    status: { HP: 627, MP: 381, atk: 367, def: 448, spd: 477, int: 503 },
    initialSkill: ["けがれの封印", "毒滅の稲妻", "みがわり", "ザラキーマ"],
    defaultGear: "ryujinNail",
    attribute: {
      initialBuffs: {
        poisonedBreak: { keepOnDeath: true, strength: 2 },
      },
    },
    seed: { atk: 0, def: 0, spd: 95, int: 25 },
    ls: { HP: 1 },
    lsTarget: "all",
    resistance: { fire: 1.5, ice: 1, thunder: 1, wind: 0.5, io: 1, light: 1.5, dark: 0.5, poisoned: 0, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "かげのきし", //444lv70 どく・ほね
    id: "kagekisi",
    rank: 6, //C
    race: ["ゾンビ"],
    weight: 3,
    status: { HP: 333, MP: 130, atk: 258, def: 224, spd: 370, int: 119 },
    initialSkill: ["ルカナン", "ルカナン", "ピオリム", "ヘルスピア"],
    defaultGear: "lightCharm",
    attribute: {},
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { def: 1.05 },
    lsTarget: "ゾンビ",
    resistance: { fire: 1.5, ice: 0.5, thunder: 1, wind: 1, io: 1, light: 1, dark: 0.5, poisoned: 0.5, asleep: 0.5, confused: 0.5, paralyzed: 1, zaki: 0, dazzle: 0.5, spellSeal: 0.5, breathSeal: 1 },
  },
  {
    name: "名もなき闇の王", //44
    id: "hazama",
    rank: 10,
    race: ["超魔王", "スライム", "ドラゴン", "自然", "魔獣", "物質", "悪魔", "ゾンビ"],
    weight: 40,
    status: { HP: 744, MP: 523, atk: 619, def: 713, spd: 459, int: 440 },
    initialSkill: ["グランドアビス", "再召喚の儀", "修羅の闇", "殺りくのツメ"],
    anotherSkills: ["混沌のキバ"],
    defaultGear: "kanazuchi",
    attribute: {
      initialBuffs: {
        darkBreak: { keepOnDeath: true, strength: 3 },
        mindBarrier: { keepOnDeath: true },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 0, def: 45, spd: 75, int: 0 },
    ls: { HP: 1.35, MP: 1.35 },
    lsTarget: "all",
    excludeLsTarget: "???",
    AINormalAttack: [3],
    resistance: { fire: 0.5, ice: 0.5, thunder: 1, wind: 1, io: 0, light: 1, dark: -1, poisoned: 1, asleep: 0.5, confused: 0, paralyzed: 0, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ガルマザード", //44 防御+100 A100 S50
    id: "garumazard",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 884, MP: 356, atk: 648, def: 633, spd: 477, int: 362 },
    initialSkill: ["マ素侵食", "ハザードウェポン", "ダークハザード", "ギガ・マホトラ"],
    defaultGear: "dragonCaneWithoutSpd",
    attribute: {
      initialBuffs: {
        darkBreak: { keepOnDeath: true, strength: 2, iconSrc: "darkBreakBoost" },
        mindAndSealBarrier: { keepOnDeath: true },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1.2, atk: 1.1 },
    lsTarget: "all",
    resistance: { fire: 1, ice: 0.5, thunder: 0.5, wind: 0.5, io: 0.5, light: 1, dark: -1, poisoned: 0, asleep: 0.5, confused: 0, paralyzed: 0, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ガルマッゾ", //44
    id: "garumazzo",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 884, MP: 356, atk: 548, def: 533, spd: 427, int: 362 },
    initialSkill: ["災禍のマ瘴", "レベル4ハザード", "ダークハザード", "マ素汚染"],
    anotherSkills: ["ギガ・マホトラ"],
    attribute: {
      initialBuffs: {
        mindAndSealBarrier: { keepOnDeath: true },
        protection: { divineDispellable: true, strength: 0.5, duration: 3 },
        martialEvasion: { duration: 3, divineDispellable: true },
      },
      evenTurnBuffs: {
        baiki: { strength: 1 },
        defUp: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      },
    },
    seed: { atk: 30, def: 25, spd: 95, int: 0 },
    seedLimit: 150,
    ls: { HP: 1.3 },
    lsTarget: "break",
    resistance: { fire: 1, ice: 0.5, thunder: 0.5, wind: 0.5, io: 0.5, light: 1, dark: -1, poisoned: 0, asleep: 0.5, confused: 0, paralyzed: 0, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "凶ブオーン", //44
    id: "buon",
    rank: 10,
    race: ["魔獣"],
    weight: 25,
    status: { HP: 937, MP: 294, atk: 561, def: 507, spd: 451, int: 135 },
    initialSkill: ["あらしの乱舞", "マ素のはどう", "こうせきおとし", "ピオリム"],
    anotherSkills: ["マデュライトナックル"],
    defaultGear: "kudaki",
    attribute: {
      initialBuffs: {
        isUnbreakable: { keepOnDeath: true, name: "くじけぬ心" },
        mindBarrier: { duration: 3 },
      },
      evenTurnBuffs: {
        baiki: { strength: 2 },
        intUp: { strength: 2 },
        defUp: { strength: -1, probability: 0.8 },
        spellBarrier: { strength: -1, probability: 0.8 },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1.2 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 1, thunder: 0, wind: 1.5, io: 1, light: 1, dark: 0.5, poisoned: 0, asleep: 1, confused: 0.5, paralyzed: 0.5, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "凶帝王エスターク", //44
    id: "cursedesta",
    rank: 10,
    race: ["???"],
    weight: 32,
    status: { HP: 748, MP: 329, atk: 571, def: 561, spd: 499, int: 415 },
    initialSkill: ["凶帝王の双閃", "爆炎の絶技", "凶帝王のかまえ", "スパークふんしゃ"],
    anotherSkills: ["イオマータ"],
    defaultGear: "cursedestaSword",
    attribute: {
      initialBuffs: {
        ioBreak: { keepOnDeath: true, strength: 2 },
        demonKingBarrier: { divineDispellable: true },
        protection: { strength: 0.5, duration: 3 },
      },
      evenTurnBuffs: {
        baiki: { strength: 2 },
        intUp: { strength: 2 },
        defUp: { strength: -1 },
        aiExtraAttacks: { keepOnDeath: true, strength: 1 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { atk: 1.18 },
    lsTarget: "all",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 0, thunder: 1, wind: 0.5, io: 1, light: 0, dark: 0.5, poisoned: 1, asleep: 1, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 0, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "凶ウルトラメタキン", //44
    id: "ultrametakin",
    rank: 10,
    race: ["スライム"],
    weight: 25,
    status: { HP: 227, MP: 469, atk: 522, def: 906, spd: 476, int: 302 },
    initialSkill: ["プチマダンテ・凶", "マ瘴の爆発", "みがわり", "光のはどう"],
    anotherSkills: ["バイオスタンプ"],
    defaultGear: "familyNailRadiantWave",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.33, isMetal: true },
        mpCostMultiplier: { strength: 2, keepOnDeath: true },
        ioBreak: { keepOnDeath: true, strength: 1 },
        mindBarrier: { duration: 3 },
      },
    },
    seed: { atk: 40, def: 5, spd: 75, int: 0 },
    ls: { HP: 1.2 },
    lsTarget: "break",
    resistance: { fire: 0, ice: 0, thunder: 0, wind: 0, io: 0, light: 0, dark: 0, poisoned: 0, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "凶メタルキング", //4
    id: "smetakin",
    rank: 9,
    race: ["スライム"],
    weight: 18,
    status: { HP: 205, MP: 424, atk: 494, def: 856, spd: 439, int: 271 },
    initialSkill: ["みがわり", "バイオスタンプ", "防刃の守り", "ザオリク"],
    defaultGear: "familyNail",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        metal: { keepOnDeath: true, strength: 0.33, isMetal: true },
        mpCostMultiplier: { strength: 2, keepOnDeath: true },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.15 },
    lsTarget: "break",
    resistance: { fire: 0, ice: 0, thunder: 0, wind: 0, io: 0, light: 0, dark: 0, poisoned: 0, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "凶グレートオーラス", //444
    id: "cursedgreatwalrus",
    rank: 9,
    race: ["魔獣"],
    weight: 16,
    status: { HP: 840, MP: 369, atk: 438, def: 540, spd: 242, int: 354 },
    initialSkill: ["におうだち", "結晶拳・終", "みがわり", "結晶拳・疾風"],
    defaultGear: "familyNail",
    defaultAiType: "いのちだいじに",
    attribute: {
      evenTurnBuffs: {
        defUp: { strength: 1 },
        spellBarrier: { strength: 1 },
        baiki: { strength: -1 },
        intUp: { strength: -1 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.2 },
    lsTarget: "魔獣",
    resistance: { fire: 1.5, ice: 0, thunder: 1, wind: 0.5, io: 1, light: 0.5, dark: 1, poisoned: 0.5, asleep: 1, confused: 0.5, paralyzed: 0, zaki: 0.5, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "凶シーライオン", //44
    id: "cursedsealion",
    rank: 8,
    race: ["魔獣"],
    weight: 8,
    status: { HP: 656, MP: 320, atk: 380, def: 427, spd: 221, int: 327 },
    initialSkill: ["みがわり", "結晶拳・疾風", "防刃の守り", "タップダンス"],
    defaultGear: "familyNail",
    defaultAiType: "いのちだいじに",
    attribute: {
      evenTurnBuffs: {
        defUp: { strength: 1 },
        spellBarrier: { strength: 1 },
        baiki: { strength: -1 },
        intUp: { strength: -1 },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1.15 },
    lsTarget: "魔獣",
    resistance: { fire: 1.5, ice: 0, thunder: 1, wind: 0.5, io: 1, light: 0.5, dark: 1, poisoned: 0.5, asleep: 1, confused: 0.5, paralyzed: 0.5, zaki: 0.5, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "やきとり",
    id: "bossmaen",
    rank: 10,
    race: ["ゾンビ"],
    weight: 25,
    status: { HP: 300000, MP: 999, atk: 600, def: 450, spd: 300, int: 600 },
    initialSkill: ["終の流星", "溶熱の儀式", "debugbreath", "神のはどう"],
    initialAIDisabledSkills: ["永劫の闇冥", "必殺の双撃", "ソウルハーベスト"],
    anotherSkills: ["ベホマラー"],
    defaultGear: "ryujinNail",
    defaultAiType: "いのちだいじに",
    attribute: {
      initialBuffs: {
        fireBreak: { keepOnDeath: true, strength: 1 },
        mindBarrier: { duration: 3 },
        asleep: { duration: 999 },
        elementalShield: { targetElement: "all", remain: 3000, unDispellable: true },
      },
      permanentBuffs: {
        elementalShield: { targetElement: "all", remain: 3000, unDispellable: true },
      },
    },
    seed: { atk: 55, def: 0, spd: 65, int: 0 },
    ls: { HP: 1 },
    lsTarget: "ゾンビ",
    AINormalAttack: [2],
    resistance: { fire: 1, ice: 1, thunder: 0.5, wind: 0.5, io: 0.5, light: 0.5, dark: 0, poisoned: 0.5, asleep: 0.5, confused: 1.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
];
//ウェイトなども。あと、特技や特性は共通項もあるので別指定も可能。

// 必要ならばasyncにする 味方に対する.push系の重複付与に注意
function getMonsterAbilities(monsterId) {
  const monsterAbilities = {
    masudora: {
      initialAbilities: [
        {
          name: "全能の加護",
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("ドラゴン")) {
                applyBuff(monster, { allElementalBoost: { strength: 0.2, duration: 4 } });
              }
            }
          },
        },
        {
          name: "天の竜気上昇付与",
          disableMessage: true,
          unavailableIf: (skillUser) => skillUser.abilities.additionalAfterActionAbilities.some((ability) => ability.name === "天の竜気上昇"),
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("ドラゴン")) {
                monster.abilities.additionalAfterActionAbilities.push({
                  name: "天の竜気上昇",
                  disableMessage: true,
                  unavailableIf: (skillUser, executingSkill, executedSkills) => {
                    const aliveMasudora = parties[skillUser.teamID].filter((member) => member.id === "masudora" && !member.flags.isDead);
                    // 生存しているマスドラがいない または skillが実行されてない時はunavailable
                    if (aliveMasudora.length < 1 || !executingSkill) {
                      return true;
                    } else {
                      if (executingSkill.name === "涼風一陣") {
                        return false;
                      } else if (executingSkill.type === "breath") {
                        return false;
                      } else if (executingSkill.type === "martial") {
                        return Math.random() < 0.576; //0.424
                      } else {
                        return true;
                      }
                    }
                  },
                  act: async function (skillUser, executingSkill) {
                    await applyDragonPreemptiveAction(skillUser, executingSkill);
                  },
                });
              }
            }
          },
        },
      ],
      supportAbilities: {
        1: [
          {
            name: "一族の息吹",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("ドラゴン")) {
                  applyBuff(monster, { allElementalBreak: { strength: 1, duration: 4, divineDispellable: true } });
                  await sleep(150);
                }
              }
            },
          },
        ],
      },
      attackAbilities: {
        permanentAbilities: [
          {
            name: "天の竜気発動",
            disableMessage: true,
            isOneTimeUse: true,
            unavailableIf: (skillUser) => !skillUser.buffs.dragonPreemptiveAction || skillUser.buffs.dragonPreemptiveAction.strength < 3,
            act: async function (skillUser) {
              const aliveDragons = parties[skillUser.teamID].filter((member) => member.race.includes("ドラゴン") && !member.flags.isDead);
              for (const member of aliveDragons) {
                displayMessage("天の竜気の", "効果が発動！");
                applyBuff(member, { preemptiveAction: {} });
                await sleep(150);
              }
            },
          },
        ],
      },
    },
    rusia: {
      supportAbilities: {
        1: [
          {
            name: "サンセットビーチ",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                applyBuff(monster, { fireGuard: { strength: 0.5, duration: 4 } });
                await sleep(150);
              }
              if (!hasEnoughMonstersOfType(parties[skillUser.teamID], "ドラゴン", 5)) {
                for (const monster of parties[skillUser.enemyTeamID]) {
                  applyBuff(monster, { fireGuard: { strength: 0.5, duration: 4 } });
                  await sleep(150);
                }
              }
            },
          },
        ],
      },
    },
    sinri: {
      initialAbilities: [
        {
          name: "祭の名残",
          unavailableIf: (skillUser) => skillUser.abilities.additionalAfterActionAbilities.some((ability) => ability.name === "祭の名残付与"),
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("ドラゴン")) {
                monster.abilities.additionalAfterActionAbilities.push({
                  name: "祭の名残付与",
                  disableMessage: true,
                  act: async function (skillUser, executingSkill) {
                    applyBuff(skillUser, { sinriReduction: { duration: 1, removeAtTurnStart: true, unDispellable: true } });
                  },
                });
              }
            }
          },
        },
      ],
      attackAbilities: {
        1: [
          {
            name: "竜衆の鎮魂",
            unavailableIf: (skillUser) => !hasEnoughMonstersOfType(parties[skillUser.teamID], "ドラゴン", 5),
            act: async function (skillUser) {
              for (const monster of parties[skillUser.enemyTeamID]) {
                applyBuff(monster, { reviveBlock: { name: "竜衆の鎮魂", duration: 1 } });
              }
            },
          },
        ],
      },
    },
    orochi: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "怪竜の竜鱗",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
        1: [
          {
            name: "竜衆の先鋒",
            unavailableIf: (skillUser) => !hasEnoughMonstersOfType(parties[skillUser.teamID], "ドラゴン", 3),
            act: function (skillUser) {
              applyBuff(skillUser, { preemptiveAction: {} });
            },
          },
        ],
      },
      attackAbilities: {
        permanentAbilities: [
          {
            name: "紅蓮の炎熱",
            act: function (skillUser) {
              for (const monster of parties[skillUser.enemyTeamID]) {
                applyBuff(monster, { fireResistance: { strength: -1 } });
              }
            },
          },
        ],
      },
    },
    voruka: {
      supportAbilities: {
        1: [
          {
            name: "竜衆の防魔",
            act: async function (skillUser) {
              if (hasEnoughMonstersOfType(parties[skillUser.teamID], "ドラゴン", 5)) {
                for (const monster of parties[skillUser.teamID]) {
                  applyBuff(monster, { spellBarrier: { strength: 1 } });
                  await sleep(150);
                }
              } else {
                applyBuff(skillUser, { spellBarrier: { strength: 2 } });
              }
            },
          },
          {
            name: "竜衆の溶鉄",
            unavailableIf: (skillUser) => !hasEnoughMonstersOfType(parties[skillUser.teamID], "ドラゴン", 3),
            act: async function (skillUser) {
              displayMessage("アストロンを ふうじられた！");
              if (!fieldState.psychoField) {
                fieldState.stonedBlock = 3;
                // 全体buff表示更新
                for (const party of parties) {
                  for (const monster of party) {
                    await updateMonsterBuffsDisplay(monster);
                  }
                }
              }
            },
          },
        ],
      },
      deathAbilities: [
        {
          name: "最後に祝福",
          isOneTimeUse: true,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              applyBuff(monster, { continuousHealing: { removeAtTurnStart: true, duration: 3 } });
            }
          },
        },
      ],
    },
    sinryu: {
      afterActionHealAbilities: [
        {
          name: "自動MP超回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.MP * 0.15, true);
          },
        },
      ],
    },
    haruto: {
      reviveAct: async function (monster, buffName) {
        if (buffName === "竜の血に選ばれし者") {
          applyBuff(monster, { spdUp: { strength: 2 } });
        }
      },
    },
    cursedskull: {
      initialAbilities: [
        {
          name: "亡者の恨み",
          act: function (skillUser) {
            skillUser.flags.zombieProbability = 0.5;
          },
        },
      ],
    },
    world: {
      initialAbilities: [
        {
          name: "反撃ののろし",
          unavailableIf: (skillUser) => skillUser.abilities.additionalDeathAbilities.some((ability) => ability.name === "反撃ののろしダメージバフ"),
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              applyBuff(monster, { deathAbility: { keepOnDeath: true } });
              monster.abilities.additionalDeathAbilities.push({
                name: "反撃ののろしダメージバフ", // 毒供物カウントリザオカンダタ1回目は発動せず 2回目は発動 死者に付与せず亡者は自己含め付与 発動回数制限なし
                message: function (skillUser) {
                  displayMessage(`${skillUser.name} がチカラつき`, "反撃ののろし の効果が発動！");
                },
                act: async function (skillUser) {
                  for (const monster of parties[skillUser.teamID]) {
                    if (!monster.flags.isDead) {
                      applyBuff(monster, { worldBuff: { keepOnDeath: true, strength: 0.05, zombieBuffable: true } });
                      await sleep(100);
                    }
                  }
                },
              });
            }
          },
        },
      ],
      deathAbilities: [
        {
          name: "反撃ののろし回復",
          isOneTimeUse: true,
          message: function (skillUser) {
            displayMessage(`${skillUser.name}が チカラつき`, "反撃ののろしがあがった！");
          },
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              applyBuff(monster, { continuousHealing: { removeAtTurnStart: true, duration: 3 } });
            }
          },
        },
      ],
    },
    nerugeru: {
      initialAbilities: [
        {
          act: function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.name !== "死を統べる者ネルゲル" && monster.skill[3] !== "プチ神のはどう" && monster.rank > 7) {
                monster.skill[3] = "供物をささげる";
              }
            }
          },
        },
      ],
      supportAbilities: {
        permanentAbilities: [
          {
            name: "死の化身",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
      },
      afterActionAbilities: [
        {
          name: "冥王の構え付与",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の特性により`, "冥王の構え が発動！");
          },
          unavailableIf: (skillUser, executingSkill, executedSkills) => !executingSkill || executingSkill.type !== "slash",
          act: async function (skillUser, executingSkill) {
            await executeSkill(skillUser, findSkillByName("冥王の構え"));
          },
        },
      ],
    },
    erugi: {
      initialAttackAbilities: [
        {
          name: "天使のしるし付与",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の特性`, "天使のしるし が発動！");
          },
          act: function (skillUser) {
            for (const monster of parties[skillUser.enemyTeamID]) {
              applyBuff(monster, { angelMark: { keepOnDeath: true } });
            }
          },
        },
      ],
      supportAbilities: {
        permanentAbilities: [
          {
            name: "堕天の化身",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
      },
    },
    ifshiba: {
      tagTransformationAct: async function (monster, buffName) {
        if (buffName === "幻獣のタッグ") {
          if (Math.random() < 0.5) {
            applyBuff(monster, { slashReflection: { strength: 1, removeAtTurnStart: true, duration: 1, skipReflectionEffect: true } });
          } else {
            applyBuff(monster, { spellReflection: { strength: 1, removeAtTurnStart: true, duration: 1, skipReflectionEffect: true } });
          }
        }
      },
      followingAbilities: {
        name: "双璧の幻獣・改",
        availableIf: (skillUser, executingSkill) => executingSkill.type !== "notskill" && (executingSkill.element === "fire" || executingSkill.element === "ice"),
        getFollowingSkillName: (executingSkill) => {
          if (executingSkill.element === "fire") return "アイスエイジ";
          if (executingSkill.element === "ice") return "地獄の火炎";
        },
      },
    },
    sosiden: {
      tagTransformationAct: async function (monster, buffName) {
        if (buffName === "伝説のタッグ3") {
          monster.skill[1] = "ひかりのたま";
          monster.iconSrc = "images/icons/" + monster.id + "Transformed.jpeg";
          updateBattleIcons(monster);
          await sleep(150);
          applyHeal(monster, monster.defaultStatus.MP, true);
          await sleep(250);
          delete monster.buffs.lightSuperBreak;
          applyBuff(monster, { lightUltraBreak: { keepOnDeath: true } });
          applyBuff(monster, { baiki: { strength: 1 }, defUp: { strength: 1 }, spdUp: { strength: 1 }, intUp: { strength: 1 } });
          applyBuff(monster, {
            martialReflection: {
              strength: 1.5,
              duration: 2,
              removeAtTurnStart: true,
              unDispellable: true,
              skipReflectionEffect: true,
              dispellableByAbnormality: true,
              dispellableBySpecificAbnormality: true,
            },
          });
          applyBuff(monster, { sosidenBarrier: { duration: 2, removeAtTurnStart: true, divineDispellable: true } });
          applyBuff(monster, { demonKingBarrier: { duration: 2, removeAtTurnStart: true, divineDispellable: true, iconSrc: "none" } });
        }
      },
    },
    arehu: {
      tagTransformationAct: async function (monster, buffName) {
        if (buffName === "伝説のタッグ1") {
          monster.skill[1] = "王女の愛";
          //monster.iconSrc = "images/icons/" + monster.id + "Transformed.jpeg";
          //updateBattleIcons(monster);
          await sleep(150);
          applyHeal(monster, monster.defaultStatus.MP, true);
          await sleep(250);
          delete monster.buffs.fireBreak;
          delete monster.buffs.thunderSuperBreak;
          applyBuff(monster, { thunderUltraBreak: { keepOnDeath: true } });
          applyBuff(monster, { protection: { divineDispellable: true, strength: 0.7, duration: 3 } });
          applyBuff(monster, { baiki: { strength: 1 }, defUp: { strength: 1 }, spdUp: { strength: 1 }, intUp: { strength: 1 } });
        }
      },
    },
    arina: {
      tagTransformationAct: async function (monster, buffName) {
        if (buffName === "伝説のタッグ4") {
          monster.skill[1] = "ひしょうきゃく";
          monster.iconSrc = "images/icons/" + monster.id + "Transformed.jpeg";
          updateBattleIcons(monster);
          await sleep(150);
          applyHeal(monster, monster.defaultStatus.MP, true);
          await sleep(250);
          delete monster.buffs.iceSuperBreak;
          applyBuff(monster, { iceUltraBreak: { keepOnDeath: true } });
          applyBuff(monster, { protection: { divineDispellable: true, strength: 0.5, duration: 3 } });
          applyBuff(monster, { dodgeBuff: { strength: 0.7, duration: 3 } });
          applyBuff(monster, { baiki: { strength: 1 }, defUp: { strength: 1 }, spdUp: { strength: 1 }, intUp: { strength: 1 } });
        }
      },
    },
    babara: {
      tagTransformationAct: async function (monster, buffName) {
        if (buffName === "伝説のタッグ6") {
          monster.skill[1] = "至高の閃光";
          monster.iconSrc = "images/icons/" + monster.id + "Transformed.jpeg";
          updateBattleIcons(monster);
          await sleep(150);
          applyHeal(monster, monster.defaultStatus.MP, true);
          await sleep(250);
          delete monster.buffs.fireSuperBreak;
          delete monster.buffs.lightSuperBreak;
          applyBuff(monster, { fireUltraBreak: { keepOnDeath: true } });
          applyBuff(monster, { protection: { divineDispellable: true, strength: 0.5, duration: 3 } });
          applyBuff(monster, { baiki: { strength: 1 }, defUp: { strength: 1 }, spdUp: { strength: 1 }, intUp: { strength: 1 } });
        }
      },
      afterActionHealAbilities: [
        {
          name: "自動MP超回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.MP * 0.15, true);
          },
        },
      ],
    },
    zesika: {
      tagTransformationAct: async function (monster, buffName) {
        if (buffName === "伝説のタッグ8") {
          monster.skill[1] = "セクシービーム";
          monster.iconSrc = "images/icons/" + monster.id + "Transformed.jpeg";
          updateBattleIcons(monster);
          await sleep(150);
          applyHeal(monster, monster.defaultStatus.MP, true);
          await sleep(250);
          delete monster.buffs.ioSuperBreak;
          delete monster.buffs.darkSuperBreak;
          monster.buffs.darkBreak.strength = 1;
          applyBuff(monster, { ioUltraBreak: { keepOnDeath: true } });
          applyBuff(monster, { protection: { divineDispellable: true, strength: 0.5, duration: 3 } });
          applyBuff(monster, { baiki: { strength: 1 }, defUp: { strength: 1 }, spdUp: { strength: 1 }, intUp: { strength: 1 } });
        }
      },
    },
    aban: {
      tagTransformationAct: async function (monster, buffName) {
        if (buffName === "因縁のタッグ") {
          monster.iconSrc = "images/icons/" + monster.id + "Transformed.jpeg";
          updateBattleIcons(monster);
          await sleep(150);
          applyHeal(monster, monster.defaultStatus.MP, true);
          await sleep(250);
          // カウント死の場合先制化
          if (fieldState.turnNum === 2) {
            monster.skill[1] = "火竜変化呪文先制";
            displayMessage("火竜変化呪文が", "【先制】に なった！");
            applyBuff(monster, { abanPreemptive: { keepOnDeath: true } });
          } else {
            monster.skill[1] = "火竜変化呪文";
          }
          delete monster.buffs.thunderBreak;
          delete monster.buffs.ioBreak;
          monster.buffs.fireBreak.strength = 2;
          delete monster.buffs.fireSuperBreak;
          applyBuff(monster, { fireUltraBreak: { keepOnDeath: true } });
          applyBuff(monster, { protection: { divineDispellable: true, strength: 0.4, duration: 3, iconSrc: "protectiondivineDispellablestr0.4" } });
          applyBuff(monster, { baiki: { strength: 1 }, defUp: { strength: 1 }, spdUp: { strength: 1 }, intUp: { strength: 1 } });
        }
      },
      supportAbilities: {
        permanentAbilities: [
          {
            name: "赤い鱗",
            unavailableIf: (skillUser) => !skillUser.flags.abanTransformed,
            act: async function (skillUser) {
              applyHeal(skillUser, skillUser.currentStatus.HP * 0.1);
            },
          },
        ],
      },
    },
    tyoryu: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "闇の炎の化身",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
          {
            name: "闇の闘気",
            unavailableIf: (skillUser) => skillUser.flags.hasTransformed,
            act: async function (skillUser) {
              if (!skillUser.buffs.tyoryuLevel) {
                applyBuff(skillUser, { tyoryuLevel: { unDispellable: true, strength: 1 } });
              } else {
                const newStrength = Math.min(3, skillUser.buffs.tyoryuLevel.strength + 1);
                skillUser.buffs.tyoryuLevel.strength = newStrength;
                updateMonsterBuffsDisplay(skillUser);
              }
            },
          },
        ],
      },
      attackAbilities: {
        permanentAbilities: [
          {
            name: "超竜王変身",
            disableMessage: true,
            isOneTimeUse: true,
            unavailableIf: (skillUser) => skillUser.buffs.tyoryuLevel?.strength < 3 || skillUser.flags.hasTransformed,
            act: async function (skillUser) {
              await transformTyoma(skillUser);
            },
          },
        ],
      },
    },
    tyopi: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "疾風の化身",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
      },
      attackAbilities: {
        permanentAbilities: [
          {
            name: "黄金の秘法",
            disableMessage: true,
            isOneTimeUse: true,
            unavailableIf: (skillUser) => fieldState.turnNum < 3 || skillUser.flags.hasTransformed,
            act: async function (skillUser) {
              await transformTyoma(skillUser);
            },
          },
        ],
      },
      afterActionAbilities: [
        {
          name: "剣聖",
          disableMessage: true,
          unavailableIf: (skillUser, executingSkill, executedSkills) => !executingSkill || executingSkill.type !== "slash" || (skillUser.flags.hasTransformed && !skillUser.flags.hasTransformedSword),
          act: async function (skillUser, executingSkill) {
            await sleep(100);
            // 変身処理
            if (fieldState.turnNum === 2 && !skillUser.flags.hasTransformed) {
              displayMessage(`${skillUser.name}は`, "覚醒した！");
              skillUser.iconSrc = "images/icons/" + skillUser.id + "TransformedSword.jpeg";
              updateBattleIcons(skillUser);
              skillUser.flags.hasTransformed = true;
              skillUser.flags.hasTransformedSword = true;
              delete skillUser.buffs.sealed; // 封印は共通で解除
              await executeRadiantWave(skillUser);
              // skill変更
              skillUser.skill[0] = "剣聖刃";
              skillUser.skill[1] = "貴公子の円舞";
              // 次ターン回復を付与
              skillUser.abilities.supportAbilities.nextTurnAbilities.push({
                disableMessage: true,
                act: async function (skillUser) {
                  applyDamage(skillUser, skillUser.defaultStatus.HP, -1);
                  await sleep(500);
                  applyDamage(skillUser, skillUser.defaultStatus.MP, -1, true);
                },
              });
              // つねにこうどうはやい
              skillUser.attribute.additionalPermanentBuffs.preemptiveAction = {};
              await sleep(400);
              // 共通バフ
              applyBuff(skillUser, { demonKingBarrier: { divineDispellable: true } });
              await sleep(150);
              applyBuff(skillUser, { nonElementalResistance: {} });
              await sleep(150);
              applyBuff(skillUser, { protection: { divineDispellable: true, strength: 0.5, duration: 3 } });
              await sleep(150);
            }
            // 反射処理
            applyBuff(skillUser, {
              slashReflection: { unDispellable: true, dispellableByAbnormality: true, strength: 1, removeAtTurnStart: true, duration: 1, isKanta: true, skipReflectionEffect: true },
            });
            displayMessage(`${skillUser.name}は`, "みがまえた！");
          },
        },
      ],
      afterActionHealAbilities: [
        {
          name: "自動MP大回復",
          unavailableIf: (skillUser) => !skillUser.flags.hasTransformed || skillUser.flags.hasTransformedSword,
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.MP * 0.1, true);
          },
        },
      ],
      counterAbilities: [
        {
          name: "異形の再生",
          unavailableIf: (skillUser) => !skillUser.flags.hasTransformed || skillUser.flags.hasTransformedSword,
          act: async function (skillUser, counterTarget) {
            applyHeal(skillUser, skillUser.defaultStatus.HP * 0.2); //20%
          },
        },
      ],
    },
    vearn: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "大魔王の魔力",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
        evenTurnAbilities: [
          {
            name: "鬼眼のチカラ",
            disableMessage: true,
            unavailableIf: (skillUser) => !skillUser.flags.hasTransformed,
            act: async function (skillUser) {
              applyHeal(skillUser, 45, true);
            },
          },
        ],
        1: [
          {
            name: "光魔の杖",
            unavailableIf: (skillUser) => skillUser.flags.hasTransformed,
            act: async function (skillUser) {
              applyDamage(skillUser, 60, 1, true);
              applyBuff(skillUser, { manaBoost: { strength: 1.2, name: "光魔の杖" } });
              await sleep(100);
              applyBuff(skillUser, { powerCharge: { strength: 1.2, name: "光魔の杖" } });
            },
          },
        ],
        2: [
          {
            name: "光魔の杖",
            unavailableIf: (skillUser) => skillUser.flags.hasTransformed,
            act: async function (skillUser) {
              applyDamage(skillUser, 60, 1, true);
              applyBuff(skillUser, { manaBoost: { strength: 1.2, name: "光魔の杖" } });
              await sleep(100);
              applyBuff(skillUser, { powerCharge: { strength: 1.2, name: "光魔の杖" } });
            },
          },
        ],
      },
      attackAbilities: {
        permanentAbilities: [
          {
            name: "瞳化",
            unavailableIf: (skillUser) => !skillUser.flags.hasTransformed || skillUser.buffs.vearnBarrier,
            act: async function (skillUser) {
              for (const monster of parties[skillUser.enemyTeamID]) {
                if (monster.buffs.kiganLevel && monster.buffs.kiganLevel.strength === 3) {
                  delete monster.buffs.kiganLevel;
                  applyBuff(monster, { sealed: {} });
                }
              }
            },
          },
        ],
      },
      turnStartAbilities: [
        {
          name: "若さと力との融合",
          disableMessage: true,
          unavailableIf: (skillUser) => !(!skillUser.flags.hasTransformed && (skillUser.currentStatus.HP / skillUser.defaultStatus.HP <= 0.5 || fieldState.turnNum > 2)),
          act: async function (skillUser) {
            await transformTyoma(skillUser);
          },
        },
        {
          name: "鬼眼の解放",
          disableMessage: true,
          unavailableIf: (skillUser) => !(skillUser.flags.hasTransformed && !skillUser.buffs.vearnBarrier && skillUser.currentStatus.HP / skillUser.defaultStatus.HP <= 0.5),
          act: async function (monster) {
            // 2回目変身
            await sleep(200);
            monster.iconSrc = "images/icons/vearnTransformedBeast.jpeg";
            updateBattleIcons(monster);
            monster.currentStatus.MP = 0;
            updateMonsterBar(monster);
            delete monster.buffs.sealed;
            await executeRadiantWave(monster);
            monster.skill[0] = "うちくだく";
            monster.skill[1] = "鬼眼砲";
            delete monster.attribute.additionalPermanentBuffs.slashBarrier;
            delete monster.attribute.additionalPermanentBuffs.martialBarrier;
            displayMessage("＊「お前に勝つことが", "  今の余の全てなのだッ！！！");
            applyBuff(monster, { vearnBarrier: { keepOnDeath: true, strength: 0.75 } });
            await sleep(150);
            displayMessage(`${monster.name}の特性`, "魔獣化 が発動！");
            await sleep(150);
            applyBuff(monster, { nonElementalResistance: {} });
            await sleep(400);
            applyDamage(monster, monster.defaultStatus.HP, -1);
            await sleep(400);
          },
        },
      ],
    },
    dream: {
      supportAbilities: {
        evenTurnAbilities: [
          {
            act: async function (skillUser) {
              applyHeal(skillUser, 45, true);
            },
          },
        ],
      },
      afterActionAbilities: [
        {
          name: "魔神のいげん",
          unavailableIf: (skillUser, executingSkill, executedSkills) => !skillUser.flags.thisTurn.applyDreamEvasion,
          act: async function (skillUser, executingSkill) {
            delete skillUser.flags.thisTurn.applyDreamEvasion;
            applyBuff(skillUser, { spdUp: { strength: 1 } });
            skillUser.abilities.supportAbilities.nextTurnAbilities.push({
              name: "魔神のいげん",
              act: async function (skillUser) {
                applyBuff(skillUser, {
                  powerCharge: { strength: 1.1 },
                  slashEvasion: { duration: 1, removeAtTurnStart: true, divineDispellable: true },
                  spellEvasion: { duration: 1, removeAtTurnStart: true, divineDispellable: true },
                  breathEvasion: { duration: 1, removeAtTurnStart: true, divineDispellable: true },
                });
              },
            });
          },
        },
      ],
    },
    majesu: {
      supportAbilities: {
        evenTurnAbilities: [
          {
            act: async function (skillUser) {
              applyHeal(skillUser, 45, true);
            },
          },
        ],
      },
    },
    dark: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "闇の増幅",
            act: async function (skillUser) {
              const newStrength = Math.min(0.2 * fieldState.turnNum, 0.6);
              applyBuff(skillUser, { darkBuff: { keepOnDeath: true, strength: newStrength } });
            },
          },
        ],
      },
    },
    shamu: {
      afterActionHealAbilities: [
        {
          name: "自動MP回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.MP * 0.05, true);
          },
        },
      ],
    },
    asahaka: {
      initialAttackAbilities: [
        {
          name: "いきなり冥界の霧",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の特性により`, "冥界の霧 が発動！");
          },
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              applyBuff(monster, { healBlock: {} });
              await sleep(150);
            }
            for (const monster of parties[skillUser.enemyTeamID]) {
              applyBuff(monster, { healBlock: {} });
              await sleep(150);
            }
          },
        },
      ],
      supportAbilities: {
        1: [
          {
            name: "魔族の痕跡風の使い手付与",
            disableMessage: true,
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                applyBuff(monster, { windBreak: { divineDispellable: true, removeAtTurnStart: true, duration: 2, strength: 1 } }); //本来は2R行動後に解除
                displayMessage(`${monster.name}は`, "風の使い手状態になった！");
                await sleep(150);
              }
            },
          },
          {
            name: "サイコ・ワールド",
            message: function (skillUser) {
              displayMessage(`${skillUser.name}の特性`, "サイコ・ワールド が発動！");
            },
            act: async function (skillUser) {
              displayMessage("フィールド効果が無効化された！");
              delete fieldState.isPermanentReverse;
              delete fieldState.isReverse;
              delete fieldState.isPermanentDistorted;
              delete fieldState.isDistorted;
              delete fieldState.disableReverse;
              delete fieldState.stonedBlock;
              // リバース封じ解除
              fieldState.psychoField = true;
              adjustFieldStateDisplay();
            },
          },
        ],
        2: [
          {
            name: "サイコ・ワールド",
            message: function (skillUser) {
              displayMessage(`${skillUser.name}の特性`, "サイコ・ワールド が発動！");
            },
            act: async function (skillUser) {
              displayMessage("フィールド効果が無効化された！");
              delete fieldState.isPermanentReverse;
              delete fieldState.isReverse;
              delete fieldState.isPermanentDistorted;
              delete fieldState.isDistorted;
              delete fieldState.disableReverse;
              delete fieldState.stonedBlock;
              // リバース封じ解除
              fieldState.psychoField = true;
              adjustFieldStateDisplay();
            },
          },
        ],
      },
    },
    snogu: {
      deathAbilities: [
        {
          name: "最後の息吹",
          isOneTimeUse: true,
          act: async function (skillUser) {
            const randomAlly = getRandomLivingPartyMember(skillUser);
            if (randomAlly) {
              applyBuff(randomAlly, { baiki: { strength: 1 } });
              await sleep(150);
              applyBuff(randomAlly, { defUp: { strength: 1 } });
              await sleep(150);
              applyBuff(randomAlly, { spdUp: { strength: 1 } });
              await sleep(150);
              applyBuff(randomAlly, { intUp: { strength: 1 } });
              await sleep(150);
            }
          },
        },
      ],
    },
    kids: {
      afterActionHealAbilities: [
        {
          name: "自動HP大回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.HP * 0.15);
          },
        },
      ],
    },
    skull: {
      initialAbilities: [
        {
          name: "亡者の執念",
          act: function (skillUser) {
            skillUser.flags.zombieProbability = 1;
          },
        },
      ],
    },
    omudo: {
      supportAbilities: {
        2: [
          {
            message: function (skillUser) {
              displayMessage(`${skillUser.name}の`, "まわりの時間が巻き戻る！");
            },
            act: function (skillUser) {
              applyDamage(skillUser, skillUser.defaultStatus.HP, -1);
            },
          },
        ],
        permanentAbilities: [
          {
            name: "遡る時",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
        evenTurnAbilities: [
          {
            name: "偶数ラウンドリバース",
            message: function (skillUser) {
              displayMessage(`${skillUser.name}の特性により`, "リバースが 発動！");
            },
            act: function (skillUser) {
              displayMessage("全員の 行動順と素早さが", "逆転した！");
              if (!fieldState.psychoField && !fieldState.disableReverse) {
                fieldState.isReverse = true;
                adjustFieldStateDisplay();
              }
            },
          },
        ],
      },
      attackAbilities: {
        permanentAbilities: [
          {
            name: "オムド変身",
            disableMessage: true,
            isOneTimeUse: true,
            unavailableIf: (skillUser) => !skillUser.flags.willTransformOmudo || skillUser.flags.hasTransformed,
            act: async function (skillUser) {
              delete skillUser.flags.willTransformOmudo;
              await transformTyoma(skillUser);
            },
          },
        ],
      },
    },
    rapu: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "混沌の化身",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
        evenTurnAbilities: [
          {
            act: async function (skillUser) {
              applyHeal(skillUser, 45, true);
            },
          },
        ],
      },
      attackAbilities: {
        permanentAbilities: [
          {
            name: "ラプ変身",
            disableMessage: true,
            unavailableIf: (skillUser) => {
              // turnNum管理で、直前ターンに支配対象が完全死亡してflagが付与された場合のみ変身する
              if (!skillUser.flags.hasTransformed && skillUser.flags.rapuTransformTurn === fieldState.turnNum) {
                // handleDeath内で支配所持者が完全死亡・亡者化(リザオやタッグ以外)した場合、すべての敵ラプに次ターン数を格納したrapuTransformTurn付与
                // 未変身かつターン数が正確な場合に変身
                return false;
              } else {
                return true;
              }
            },
            act: async function (skillUser) {
              await transformTyoma(skillUser);
            },
          },
          {
            name: "暗黒神の支配",
            act: async function (skillUser) {
              // 一応既存のflagをすべて削除
              for (const party of parties) {
                for (const monster of party) {
                  delete monster.flags.rapuFlag;
                }
              }
              // デバフ付与: 自動解除  flag付与: 判定される次ターンを格納
              const aliveEnemies = parties[skillUser.enemyTeamID].filter((member) => !member.flags.isDead);
              const newTarget = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
              if (newTarget) {
                applyBuff(newTarget, { controlOfRapu: { keepOnDeath: true, removeAtTurnStart: true, duration: 1 } });
                newTarget.flags.rapuFlag = fieldState.turnNum + 1;
              }
            },
          },
        ],
      },
    },
    orugo: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "偽りの化身",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
      },
      attackAbilities: {
        abilitiesFromTurn2: [
          {
            name: "オルゴ変身第2形態",
            disableMessage: true,
            isOneTimeUse: true,
            unavailableIf: (skillUser) => skillUser.buffs.stoned || skillUser.flags.hasTransformed,
            act: async function (skillUser) {
              await transformTyoma(skillUser);
            },
          },
        ],
      },
      zombifyAct: async function (monster, zombifyActName) {
        if (zombifyActName === "不滅の美") {
          monster.iconSrc = "images/icons/orugoZombified.jpeg";
          updateBattleIcons(monster);
          displayMessage("＊「ぐははははっ！", "  おうじょうぎわの悪い やつらめ！");
          monster.flags.orugoDispelleUnbreakableAttack = true;
          await sleep(150);
          applyDamage(monster, monster.defaultStatus.MP, -1, true); //MP
        }
      },
      reviveNextTurnAct: async function (monster, reviveNextTurnActName) {
        if (reviveNextTurnActName === "怨嗟のうめき") {
          monster.skill[0] = "溶熱の儀式";
          delete monster.flags.zombieProbability;
          delete monster.flags.isUnAscensionable;
          delete monster.flags.zombifyActName;
          monster.iconSrc = "images/icons/orugoRevived.jpeg";
          updateBattleIcons(monster);
          displayMessage("＊「グゲゴゴゴゴゴ……。", "  許さぬ… 許さぬぞ……。");
          applyBuff(monster, { reviveBlock: { unDispellableByRadiantWave: true } });
          await sleep(150);
          applyDamage(monster, monster.defaultStatus.MP, -1, true); //MP
          applyBuff(monster, { countDown: { unDispellableByRadiantWave: true, count: 1, wait1Turn: true } });
        }
      },
    },
    esta: {
      supportAbilities: {
        evenTurnAbilities: [
          {
            act: async function (skillUser) {
              applyHeal(skillUser, skillUser.defaultStatus.HP * 0.4);
              await sleep(400);
              applyHeal(skillUser, 45, true);
            },
          },
        ],
      },
    },
    nadoraga: {
      afterActionAbilities: [
        {
          name: "領界召喚",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の特性`, "領界召喚 が発動！");
          },
          unavailableIf: (skillUser, executingSkill, executedSkills) =>
            !executingSkill || (executingSkill.name !== "翠嵐の息吹" && executingSkill.name !== "竜の波濤" && executingSkill.name !== "冥闇の息吹" && executingSkill.name !== "業炎の息吹"),
          act: async function (skillUser, executingSkill) {
            await sleep(200);
            const targetDomain = {
              翠嵐の息吹: "thunderDomain",
              竜の波濤: "iceDomain",
              冥闇の息吹: "darkDomain",
              業炎の息吹: "fireDomain",
            }[executingSkill.name];
            const buffToApply = {};
            buffToApply[targetDomain] = { keepOnDeath: true };
            for (const monster of parties[skillUser.teamID]) {
              delete monster.buffs.iceDomain;
              delete monster.buffs.thunderDomain;
              delete monster.buffs.darkDomain;
              delete monster.buffs.fireDomain;
              applyBuff(monster, buffToApply);
              await sleep(100);
            }
          },
        },
      ],
    },
    daguja: {
      initialAbilities: [
        {
          name: "亡者の怨嗟",
          act: function (skillUser) {
            skillUser.flags.zombieProbability = 1;
          },
        },
      ],
    },
    zoma: {
      supportAbilities: {
        evenTurnAbilities: [
          {
            name: "偶数ラウンドMP大回復",
            disableMessage: true,
            act: async function (skillUser) {
              applyHeal(skillUser, 60, true);
            },
          },
        ],
      },
      attackAbilities: {
        evenTurnAbilities: [
          {
            name: "偶数ラウンド真いてつくはどう",
            unavailableIf: (skillUser) => !skillUser.gear || skillUser.gear.name !== "ゾーマのローブ",
            message: function (skillUser) {
              displayMessage("そうびの特性により", "真・いてつくはどう が発動！");
            },
            act: async function (skillUser) {
              await executeSkill(skillUser, findSkillByName("真・いてつくはどう"), null, false, null, false, true, null);
            },
          },
        ],
      },
    },
    paradhi: {
      initialAbilities: [
        {
          name: "聖騎士のよろい",
          unavailableIf: (skillUser) => countSameRaceMonsters(skillUser) !== 1,
          act: async function (skillUser) {
            applyBuff(skillUser, { defUp: { strength: 1 } });
          },
        },
      ],
      followingAbilities: {
        name: "斬撃で魔神斬り",
        availableIf: (skillUser, executingSkill) => isDamageExistingSkill(executingSkill) && executingSkill.type === "slash",
        getFollowingSkillName: (executingSkill) => {
          return "魔神斬り";
        },
      },
    },
    hyadonisu: {
      counterAbilities: [
        {
          name: "氷晶の加護",
          act: async function (skillUser, counterTarget) {
            applyHeal(skillUser, skillUser.defaultStatus.HP * 0.2);
            await executeRadiantWave(skillUser);
          },
        },
      ],
    },
    yoiyami: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "毎回マインドバリア",
            message: function (skillUser) {
              displayMessage(`${skillUser.name}の特性により`, "マインドバリア が発動！");
            },
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                applyBuff(monster, { mindBarrier: { duration: 4 } });
              }
            },
          },
        ],
      },
      deathAbilities: [
        {
          name: "封印の光",
          isOneTimeUse: true,
          unavailableIf: (skillUser) => !skillUser.flags.perpetrator,
          act: async function (skillUser) {
            const skillTarget = skillUser.flags.perpetrator;
            await executeWave(skillTarget, true, true);
            applyBuff(skillTarget, { statusLock: {} });
          },
        },
      ],
    },
    dhuran: {
      supportAbilities: {
        1: [
          {
            name: "強者のいげん",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("悪魔")) {
                  applyBuff(monster, { martialBarrier: { strength: 1 }, slashBarrier: { strength: 1 } });
                } else {
                  displayMiss(monster);
                }
              }
            },
          },
        ],
      },
    },
    tanisu: {
      supportAbilities: {
        1: [
          {
            name: "一族のいかり",
            unavailableIf: (skillUser) => skillUser.abilities.additionalDeathAbilities.some((ability) => ability.name === "一族のいかり"),
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("悪魔")) {
                  applyBuff(monster, { deathAbility: { keepOnDeath: true } });
                  monster.abilities.additionalDeathAbilities.push({
                    name: "一族のいかり",
                    message: function (skillUser) {
                      displayMessage(`${skillUser.name} がチカラつき`, "一族のいかり の効果が発動！");
                    },
                    ignoreSkipDeathAbilityFlag: true, //毒 反射 供物でも実行
                    act: async function (skillUser) {
                      for (const monster of parties[skillUser.teamID]) {
                        if (!monster.flags.isDead && monster.race.includes("悪魔")) {
                          applyBuff(monster, { baiki: { strength: 1 } });
                          await sleep(150);
                          applyBuff(monster, { defUp: { strength: 1 } });
                          await sleep(150);
                          applyBuff(monster, { spdUp: { strength: 1 } });
                          await sleep(150);
                          applyBuff(monster, { intUp: { strength: 1 } });
                          await sleep(150);
                        }
                      }
                    },
                  });
                } else {
                  displayMiss(skillUser);
                }
              }
            },
          },
        ],
      },
      attackAbilities: {
        1: [
          {
            name: "禁忌の封印",
            message: function (skillUser) {
              displayMessage("特性により", "禁忌の封印 が発動！");
            },
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("悪魔")) {
                  // damageには自動的に、spdMultiplierには+0.5  tabooSeal所持時は0.5を引いて無効化
                  applyBuff(monster, { tabooSeal: { keepOnDeath: true }, internalSpdUp: { keepOnDeath: true, strength: 0.5 } }, false, true);
                } else {
                  displayMiss(skillUser);
                }
              }
            },
          },
        ],
      },
      afterActionAbilities: [
        {
          name: "魔の心臓",
          isOneTimeUse: true,
          unavailableIf: (skillUser, executingSkill, executedSkills) => !executingSkill || executingSkill.type !== "martial",
          act: async function (skillUser, executingSkill, executedSkills) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("悪魔")) {
                applyBuff(monster, { revive: { keepOnDeath: true, strength: 0.5 } });
              } else {
                displayMiss(skillUser);
              }
            }
          },
        },
      ],
      afterActionHealAbilities: [
        {
          name: "超回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.HP * 0.2);
          },
        },
      ],
    },
    rogos: {
      initialAbilities: [
        {
          name: "偽神の威光付与",
          unavailableIf: (skillUser) => skillUser.abilities.supportAbilities.additionalPermanentAbilities.some((ability) => ability.name === "偽神の威光実行"),
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("悪魔")) {
                applyBuff(monster, { autoRadiantWave: { removeAtTurnStart: true, duration: 3 } });
                monster.abilities.supportAbilities.additionalPermanentAbilities.push({
                  name: "偽神の威光実行",
                  message: function (skillUser) {
                    displayMessage("偽神の威光の", "効果が発動！");
                  },
                  unavailableIf: (skillUser, executingSkill, executedSkills) => !skillUser.buffs.hasOwnProperty("autoRadiantWave"),
                  act: async function (skillUser) {
                    await executeRadiantWave(skillUser);
                  },
                });
              }
            }
          },
        },
      ],
      supportAbilities: {
        permanentAbilities: [
          {
            name: "奈落の衣",
            act: async function (skillUser) {
              if (hasAbnormality(skillUser)) {
                displayMiss(skillUser);
              } else {
                applyBuff(skillUser, { protection: { removeAtTurnStart: true, divineDispellable: true, strength: 0.5, duration: 1 } });
              }
            },
          },
        ],
      },
    },
    magesu: {
      supportAbilities: {
        1: [
          {
            name: "道化の舞踏",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("悪魔")) {
                  applyBuff(monster, { lightResistance: { strength: 1 } });
                } else {
                  displayMiss(monster);
                }
              }
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("悪魔")) {
                  applyBuff(monster, { dodgeBuff: { strength: 0.5 } });
                } else {
                  displayMiss(monster);
                }
              }
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("悪魔")) {
                  applyBuff(monster, { intUp: { strength: 1 } });
                } else {
                  displayMiss(monster);
                }
              }
            },
          },
          {
            name: "デビルバーハ",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("悪魔")) {
                  applyBuff(monster, { breathBarrier: { strength: 2 } });
                } else {
                  displayMiss(monster);
                }
              }
            },
          },
        ],
      },
      deathAbilities: [
        {
          name: "道化のさいご",
          isOneTimeUse: true,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.enemyTeamID]) {
              applyBuff(monster, { spellBarrier: { strength: -1, probability: 0.55 } });
            }
          },
        },
      ],
    },
    tseru: {
      supportAbilities: {
        1: [
          {
            name: "魔女のベール",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("悪魔")) {
                  applyBuff(monster, { slashBarrier: { strength: 1 }, paralyzeBarrier: { duration: 3 } });
                } else {
                  displayMiss(monster);
                }
              }
            },
          },
        ],
      },
      followingAbilities: {
        name: "悪魔衆の踊り",
        availableIf: (skillUser, executingSkill) => isDamageExistingSkill(executingSkill) && executingSkill.type === "dance" && hasEnoughMonstersOfType(parties[skillUser.teamID], "悪魔", 4),
        getFollowingSkillName: (executingSkill) => {
          return "ディバインフェザー";
        },
      },
    },
    mudo: {
      counterAbilities: [
        {
          name: "ねむりボディ",
          act: async function (skillUser, counterTarget) {
            applyBuff(counterTarget, { asleep: { probability: 0.562 } }, skillUser);
          },
        },
      ],
    },
    jaha: {
      reviveAct: async function (monster, buffName) {
        if (buffName === "復讐の闘志") {
          applyBuff(monster, { baiki: { strength: 1 }, defUp: { strength: 1 }, spdUp: { strength: 1 }, intUp: { strength: 1 } });
          if (Math.random() < 0.72) {
            applyBuff(monster, { revive: { keepOnDeath: true, divineDispellable: true, strength: 1, act: "復讐の闘志" } });
          }
        }
      },
    },
    iburu: {
      initialAbilities: [
        {
          name: "悪夢の再生",
          disableMessage: true,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("悪魔") && !monster.abilities.reviveAct) {
                applyBuff(monster, { revive: { keepOnDeath: true, divineDispellable: true, strength: 0.5, act: "悪夢の再生" } });
                monster.abilities.reviveAct = async function (monster, buffName) {
                  if (buffName === "悪夢の再生") {
                    applyBuff(monster, { iburuSpdUp: { divineDispellable: true, duration: 3, strength: 0.5 } });
                  }
                };
              }
            }
          },
        },
      ],
    },
    iburuNew: {
      initialAbilities: [
        {
          name: "悪夢の再生",
          disableMessage: true,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("悪魔") && !monster.abilities.reviveAct) {
                applyBuff(monster, { revive: { keepOnDeath: true, divineDispellable: true, strength: 0.5, act: "悪夢の再生" } });
                monster.abilities.reviveAct = async function (monster, buffName) {
                  if (buffName === "悪夢の再生") {
                    applyBuff(monster, { iburuSpdUp: { divineDispellable: true, duration: 3, strength: 0.5 } });
                  }
                };
              }
            }
          },
        },
        {
          name: "いきなり悪魔系にマインドバリア",
          disableMessage: true,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("悪魔")) {
                applyBuff(monster, { mindBarrier: { duration: 3 } });
              }
            }
          },
        },
      ],
      followingAbilities: {
        name: "悪魔衆の誘い",
        availableIf: (skillUser, executingSkill) => !executingSkill.order && executingSkill.type === "martial" && hasEnoughMonstersOfType(parties[skillUser.teamID], "悪魔", 5),
        getFollowingSkillName: (executingSkill) => {
          return "イブールの誘い";
        },
      },
    },
    raio: {
      deathAbilities: [
        {
          name: "ラストハザード",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の`, "ラストハザード！");
          },
          isOneTimeUse: true,
          act: async function (skillUser) {
            for (const tempTarget of parties[skillUser.enemyTeamID]) {
              let skillTarget = tempTarget;
              if (skillTarget.flags.hasSubstitute) {
                skillTarget = parties.flat().find((monster) => monster.monsterId === skillTarget.flags.hasSubstitute.targetMonsterId);
              }
              applyBuff(skillTarget, { maso: { maxDepth: 3 } });
              await sleep(100);
            }
          },
        },
      ],
    },
    cursedgreatwalrus: {
      deathAbilities: [
        {
          name: "ラストハザード",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の`, "ラストハザード！");
          },
          isOneTimeUse: true,
          act: async function (skillUser) {
            for (const tempTarget of parties[skillUser.enemyTeamID]) {
              let skillTarget = tempTarget;
              if (skillTarget.flags.hasSubstitute) {
                skillTarget = parties.flat().find((monster) => monster.monsterId === skillTarget.flags.hasSubstitute.targetMonsterId);
              }
              applyBuff(skillTarget, { maso: { maxDepth: 3 } });
              await sleep(100);
            }
          },
        },
      ],
    },
    munbaba: {
      reviveAct: async function (monster, buffName) {
        if (buffName === "神授のチカラ") {
          applyBuff(monster, { baiki: { strength: 1 }, defUp: { strength: 1 }, spellBarrier: { strength: 1 } });
          if (Math.random() < 0.72) {
            applyBuff(monster, { revive: { keepOnDeath: true, divineDispellable: true, strength: 1, act: "神授のチカラ" } });
          }
        }
      },
      counterAbilities: [
        {
          name: "はんげきのゆきだま",
          act: async function (skillUser, counterTarget) {
            await executeSkill(skillUser, findSkillByName("はんげきのゆきだま1発目"), counterTarget);
          },
        },
      ],
    },
    ketosu: {
      supportAbilities: {
        evenTurnAbilities: [
          {
            name: "おおぞらの加護",
            act: async function (skillUser) {
              applyHeal(skillUser, skillUser.defaultStatus.MP, true);
            },
          },
        ],
        4: [
          {
            name: "光の覚醒",
            act: async function (skillUser) {
              applyBuff(skillUser, { internalDefUp: { keepOnDeath: true, strength: 2 } });
              await sleep(100);
              applyBuff(skillUser, { lightBreak: { keepOnDeath: true, strength: 1, iconSrc: "lightBreakdivineDispellable" } });
            },
          },
        ],
      },
    },
    rubis: {
      initialAbilities: [
        {
          name: "光の痕跡",
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              applyBuff(monster, { lightBreak: { divineDispellable: true, removeAtTurnStart: true, duration: 2, strength: 1, iconSrc: "lightBreakBoost" } }); //本来は2R行動後に解除
            }
          },
        },
        {
          name: "せいなるまもり",
          unavailableIf: (skillUser) => countRubisTarget(parties[skillUser.teamID]) < 3,
          act: async function (skillUser) {
            const buff =
              countRubisTarget(parties[skillUser.teamID]) > 4
                ? { protection: { strength: 0.3, duration: 999, noCrimsonMist: true }, isUnbreakable: { keepOnDeath: true, name: "くじけぬ心" } }
                : { protection: { strength: 0.3, duration: 999, noCrimsonMist: true } };
            for (const monster of parties[skillUser.teamID]) {
              if (isRubisTarget(monster)) {
                applyBuff(monster, buff);
              }
            }
          },
        },
      ],
      supportAbilities: {
        permanentAbilities: [
          {
            name: "ルビスの加護",
            act: async function (skillUser) {
              const aliveallys = parties[skillUser.teamID].filter((monster) => !monster.flags.isDead);
              if (aliveallys.length > 0) {
                const times = countRubisTarget(parties[skillUser.teamID]) > 4 ? 3 : 1;
                for (let i = 0; i < times; i++) {
                  const randomTarget = aliveallys[Math.floor(Math.random() * aliveallys.length)];
                  applyBuff(randomTarget, { powerCharge: { strength: 1.3 }, manaBoost: { strength: 1.3 } });
                  await sleep(100);
                }
              }
            },
          },
        ],
      },
      afterActionHealAbilities: [
        {
          name: "自動MP超回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.MP * 0.15, true);
          },
        },
      ],
    },
    ankoku: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "毎回リビルド",
            act: async function (skillUser) {
              applyHeal(skillUser, skillUser.defaultStatus.HP * 0.5);
              await sleep(100);
              applyBuff(skillUser, { defUp: { strength: 2, probability: 0.5 } });
            },
          },
          {
            name: "ビルドアーマー",
            unavailableIf: (skillUser) => skillUser.buffs.internalDefUp && skillUser.buffs.internalDefUp.strength === 1.8,
            act: async function (skillUser) {
              let newStrength;
              if (fieldState.turnNum < 3) {
                newStrength = 0.3;
              } else if (fieldState.turnNum > 4) {
                newStrength = 1.8;
              } else {
                newStrength = 0.8;
              }
              applyBuff(skillUser, { internalDefUp: { keepOnDeath: true, strength: newStrength } });
            },
          },
        ],
        evenTurnAbilities: [
          {
            name: "防魔の鼓動",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                applyBuff(monster, { spellBarrier: { strength: 1 } });
                await sleep(100);
              }
            },
          },
        ],
        3: [
          {
            disableMessage: true,
            act: async function (skillUser) {
              for (let i = 0; i < skillUser.skill.length; i++) {
                if (skillUser.skill[i] === "暗黒しょうへき") {
                  skillUser.skill[i] = "グランドショット";
                }
              }
            },
          },
        ],
      },
    },
    natsukusha: {
      afterActionHealAbilities: [
        {
          name: "自動MP回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.MP * 0.05, true);
          },
        },
      ],
    },
    rizu: {
      initialAbilities: [
        {
          name: "悪魔衆の氷雪",
          act: async function (skillUser) {
            if (hasEnoughMonstersOfType(parties[skillUser.teamID], "悪魔", 4)) {
              applyBuff(skillUser, { iceBreak: { keepOnDeath: true, strength: 1 }, rizuIceBuff: { duration: 3 } });
            }
          },
        },
      ],
      afterActionHealAbilities: [
        {
          name: "自動MP大回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.MP * 0.1, true);
          },
        },
      ],
    },
    bigface: {
      afterActionHealAbilities: [
        {
          name: "自動HP回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.HP * 0.05);
          },
        },
      ],
    },
    azu: {
      initialAbilities: [
        {
          name: "獣衆の進撃",
          unavailableIf: (skillUser) => !hasEnoughMonstersOfType(parties[skillUser.teamID], "魔獣", 5),
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("魔獣") && !monster.buffs.aiExtraAttacks) {
                applyBuff(monster, { aiExtraAttacks: { keepOnDeath: true, strength: 1 } });
              }
            }
          },
        },
      ],
      supportAbilities: {
        permanentAbilities: [
          {
            name: "一族の爪牙",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("魔獣")) {
                  applyBuff(monster, { speedBasedAttack: { keepOnDeath: true, removeAtTurnStart: true, duration: 1 } });
                  await sleep(150);
                } else {
                  displayMiss(monster);
                }
              }
            },
          },
        ],
      },
    },
    gorago: {
      initialAbilities: [
        {
          name: "一族のほこり",
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("魔獣")) {
                applyBuff(monster, { goragoAtk: { strength: 0.15, divineDispellable: true } });
                applyBuff(monster, { goragoSpd: { strength: 0.15, divineDispellable: true } });
              }
            }
          },
        },
      ],
      supportAbilities: {
        1: [
          {
            name: "孤高の獣",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.monsterId === skillUser.monsterId) {
                  continue;
                } else if (monster.race.includes("魔獣") && !monster.abilities.additionalDeathAbilities.some((ability) => ability.name === "孤高の獣発動")) {
                  applyBuff(monster, { deathAbility: { keepOnDeath: true } });
                  monster.abilities.additionalDeathAbilities.push({
                    name: "孤高の獣発動",
                    isOneTimeUse: true,
                    ignoreSkipDeathAbilityFlag: true, //毒 反射 供物でも実行
                    message: function (skillUser) {
                      displayMessage(`${skillUser.name} がチカラつき`, "孤高の獣 の効果が発動！");
                    },
                    unavailableIf: (skillUser) => parties[skillUser.teamID].find((monster) => monster.name === "ヘルゴラゴ" && !monster.flags.isDead && !monster.flags.isZombie) === undefined,
                    act: async function (skillUser) {
                      const helgoragos = parties[skillUser.teamID].filter((monster) => monster.name === "ヘルゴラゴ" && !monster.flags.isDead && !monster.flags.isZombie);
                      for (const helgorago of helgoragos) {
                        if (!helgorago.buffs.powerCharge) {
                          applyBuff(helgorago, { powerCharge: { strength: 1.5 } });
                        } else {
                          const newStrength = Math.min(helgorago.buffs.powerCharge.strength + 0.5, 3);
                          applyBuff(helgorago, { powerCharge: { strength: newStrength } });
                        }
                      }
                    },
                  });
                } else {
                  displayMiss(skillUser);
                }
              }
            },
          },
        ],
        permanentAbilities: [
          {
            name: "孤高の獣ぴかぱ",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
      },
    },
    tenkai: {
      initialAbilities: [
        {
          name: "獣衆の保護踊り",
          disableMessage: true,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("魔獣")) {
                monster.attribute.additionalPermanentBuffs.danceEvasion = { unDispellable: true, duration: 0 };
              }
            }
          },
        },
      ],
      supportAbilities: {
        1: [
          {
            name: "獣衆の速攻・天",
            unavailableIf: (skillUser) => !hasEnoughMonstersOfType(parties[skillUser.teamID], "魔獣", 5),
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("魔獣")) {
                  applyBuff(monster, { spdUp: { keepOnDeath: true, strength: 1 } });
                  await sleep(150);
                }
              }
            },
          },
        ],
      },
    },
    reopa: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "自然治癒",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
        evenTurnAbilities: [
          {
            name: "群れのチカラ",
            unavailableIf: (skillUser) => !hasEnoughMonstersOfType(parties[skillUser.teamID], "魔獣", 4),
            act: function (skillUser) {
              applyBuff(skillUser, { alwaysCrit: { unDispellable: true, removeAtTurnStart: true, duration: 1 } });
            },
          },
        ],
      },
    },
    nijiku: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "七色の魔力",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
        1: [
          {
            name: "獣衆の速攻",
            unavailableIf: (skillUser) => !hasEnoughMonstersOfType(parties[skillUser.teamID], "魔獣", 5),
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("魔獣")) {
                  applyBuff(monster, { spdUp: { strength: 1 } });
                }
              }
            },
          },
          {
            name: "虹のベール",
            act: async function (skillUser) {
              applyBuff(skillUser, { spdUp: { strength: 1 } });
              for (const monster of parties[skillUser.teamID]) {
                applyBuff(monster, { confusionBarrier: { duration: 3 } });
                await sleep(150);
              }
            },
          },
        ],
      },
      afterActionHealAbilities: [
        {
          name: "七色の魔力",
          act: async function (skillUser) {
            applyHeal(skillUser, 100, true);
          },
        },
      ],
    },
    antbear: {
      followingAbilities: {
        name: "体技攻撃でなめまわし",
        availableIf: (skillUser, executingSkill) => isDamageExistingSkill(executingSkill) && executingSkill.type === "martial",
        getFollowingSkillName: (executingSkill) => {
          return "なめまわし";
        },
      },
    },
    goddess: {
      initialAbilities: [
        {
          name: "スラ・ライトメタルガード",
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("スライム")) {
                applyBuff(monster, { goddessLightMetal: { keepOnDeath: true, strength: 0.75 }, mpCostMultiplier: { strength: 1.2, keepOnDeath: true } });
              }
            }
          },
        },
      ],
      supportAbilities: {
        evenTurnAbilities: [
          {
            name: "あふれる光",
            act: async function (skillUser) {
              applyHeal(skillUser, 45, true);
            },
          },
        ],
        permanentAbilities: [
          {
            name: "一族のきずな",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("スライム")) {
                  applyBuff(monster, { goddessDefUp: { strength: 0.4, divineDispellable: true, duration: 3 } });
                  await sleep(150);
                  applyBuff(monster, { continuousMPHealing: { strength: 0.2, removeAtTurnStart: true, duration: 3 } });
                }
              }
            },
          },
        ],
      },
    },
    surahero: {
      supportAbilities: {
        1: [
          {
            name: "スライムの守り手",
            act: async function (skillUser) {
              if (hasEnoughMonstersOfType(parties[skillUser.teamID], "スライム", 5)) {
                for (const monster of parties[skillUser.teamID]) {
                  applyBuff(monster, { defUp: { strength: 1 } });
                  await sleep(150);
                  applyBuff(monster, { martialBarrier: { strength: 1 } });
                  await sleep(150);
                }
              } else {
                for (const monster of parties[skillUser.teamID]) {
                  applyBuff(monster, { defUp: { strength: 1 } });
                  await sleep(150);
                }
              }
            },
          },
          {
            name: "孤高の使命",
            unavailableIf: (skillUser) => hasEnoughMonstersOfType(parties[skillUser.teamID], "スライム", 3),
            act: async function (skillUser) {
              applyBuff(skillUser, { goddessDefUp: { strength: 0.2, divineDispellable: true, duration: 3, iconSrc: "heroDefUp" } });
            },
          },
        ],
      },
    },
    suragirl: {
      initialAbilities: [
        {
          name: "スライダーヒール",
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (monster.race.includes("スライム")) {
                applyBuff(monster, { continuousHealing: { removeAtTurnStart: true, duration: 3 } });
              }
            }
          },
        },
      ],
      supportAbilities: {
        permanentAbilities: [
          {
            name: "オートリペア",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
      },
    },
    surabura: {
      initialAbilities: [
        {
          name: "空の要塞",
          act: async function (skillUser) {
            if (hasEnoughMonstersOfType(parties[skillUser.teamID], "スライム", 3)) {
              applyBuff(skillUser, { spellReflection: { strength: 1, duration: 3, unDispellable: true, removeAtTurnStart: true } });
            }
          },
        },
      ],
      supportAbilities: {
        1: [
          {
            name: "スライムのとばり",
            unavailableIf: (skillUser) => !hasEnoughMonstersOfType(parties[skillUser.teamID], "スライム", 3),
            act: async function (skillUser) {
              if (hasEnoughMonstersOfType(parties[skillUser.teamID], "スライム", 5)) {
                for (const monster of parties[skillUser.teamID]) {
                  if (monster.race.includes("スライム")) {
                    applyBuff(monster, { spellBarrier: { strength: 2 } });
                    await sleep(150);
                  }
                }
              } else {
                for (const monster of parties[skillUser.teamID]) {
                  if (monster.race.includes("スライム")) {
                    applyBuff(monster, { spellBarrier: { strength: 1 } });
                    await sleep(150);
                  }
                }
              }
            },
          },
        ],
        3: [
          {
            name: "ハイパーチャージ",
            act: async function (skillUser) {
              applyHeal(skillUser, skillUser.defaultStatus.MP, true);
            },
          },
        ],
      },
    },
    haguki: {
      supportAbilities: {
        evenTurnAbilities: [
          {
            name: "あふれる光",
            act: async function (skillUser) {
              applyHeal(skillUser, 45, true);
            },
          },
          {
            name: "一族のいしん",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("スライム")) {
                  applyBuff(monster, { powerCharge: { strength: 1.2 } });
                  await sleep(150);
                  applyBuff(monster, { manaBoost: { strength: 1.2 } });
                  await sleep(150);
                  applyBuff(monster, { baiki: { strength: 1 } });
                  await sleep(150);
                  applyBuff(monster, { defUp: { strength: 1 } });
                  await sleep(150);
                  applyBuff(monster, { intUp: { strength: 1 } });
                  await sleep(150);
                }
              }
            },
          },
        ],
        permanentAbilities: [
          {
            name: "ロイヤルのかがやき",
            unavailableIf: (skillUser) => !hasEnoughMonstersOfType(parties[skillUser.teamID], "スライム", 5),
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                applyBuff(monster, { confusionBarrier: { duration: 4 } });
                await sleep(150);
                applyBuff(monster, { mindBarrier: { duration: 4 } });
                await sleep(150);
              }
            },
          },
        ],
      },
      afterActionAbilities: [
        {
          name: "王のつとめ",
          unavailableIf: (skillUser, executingSkill, executedSkills) => !executingSkill || executingSkill.type !== "spell" || !hasEnoughMonstersOfType(parties[skillUser.teamID], "スライム", 5),
          act: async function (skillUser, executingSkill, executedSkills) {
            applySubstitute(skillUser, null, true);
          },
        },
      ],
    },
    dorameta: {
      afterActionHealAbilities: [
        {
          name: "自動MP回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.MP * 0.05, true);
          },
        },
      ],
    },
    matter: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "一族のまもり",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("物質")) {
                  applyBuff(monster, { sacredBarrier: { duration: 1, removeAtTurnStart: true } });
                  await sleep(100);
                  applyBuff(monster, { protection: { strength: 0.2, duration: 1, removeAtTurnStart: true } });
                  await sleep(100);
                }
              }
            },
          },
        ],
        1: [
          {
            name: "起爆装置",
            unavailableIf: (skillUser) => skillUser.abilities.additionalDeathAbilities.some((ability) => ability.name === "起爆装置爆発"),
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("物質")) {
                  applyBuff(monster, { deathAbility: { keepOnDeath: true } });
                  monster.abilities.additionalDeathAbilities.push({
                    name: "起爆装置爆発", //リザオ 毒 (反射供物も？)は爆発しない
                    message: function (skillUser) {
                      displayMessage(`${skillUser.name}は`, "爆発した！");
                    },
                    act: async function (skillUser) {
                      await executeSkill(skillUser, findSkillByName("起爆装置"), null, false, null, false, true, null);
                    },
                  });
                } else {
                  displayMiss(skillUser);
                }
              }
            },
          },
          {
            name: "いきなり斬撃よそく",
            message: function (skillUser) {
              displayMessage(`${skillUser.name}の`, "斬撃よそく！");
            },
            act: async function (skillUser) {
              applyBuff(skillUser, { slashReflection: { strength: 1.5, duration: 1, removeAtTurnStart: true, unDispellable: true, dispellableByAbnormality: true } });
            },
          },
        ],
        3: [
          {
            name: "せん滅指令",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("物質")) {
                  applyBuff(monster, { powerCharge: { strength: 2 } });
                  await sleep(150);
                }
              }
            },
          },
          {
            name: "ハイパーチャージ",
            act: async function (skillUser) {
              applyHeal(skillUser, skillUser.defaultStatus.MP, true);
            },
          },
        ],
        6: [
          {
            name: "せん滅指令",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("物質")) {
                  applyBuff(monster, { powerCharge: { strength: 2 } });
                  await sleep(150);
                }
              }
            },
          },
        ],
        9: [
          {
            name: "せん滅指令",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("物質")) {
                  applyBuff(monster, { powerCharge: { strength: 2 } });
                  await sleep(150);
                }
              }
            },
          },
        ],
      },
      afterActionHealAbilities: [
        {
          name: "超回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.HP * 0.2);
          },
        },
      ],
    },
    weapon: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "ブーストアップ",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("物質")) {
                  applyBuff(monster, { spdUp: { strength: 1 } });
                  await sleep(150);
                }
              }
            },
          },
          {
            name: "一族のつるぎ",
            act: async function (skillUser) {
              const buffStrength = fieldState.turnNum > 2 ? 0.4 : 0.2;
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("物質")) {
                  applyBuff(monster, { weaponBuff: { strength: buffStrength, unDispellable: true, removeAtTurnStart: true, duration: 1 } });
                }
              }
            },
          },
        ],
      },
    },
    castle: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "物質衆のよろい",
            unavailableIf: (skillUser) => !hasEnoughMonstersOfType(parties[skillUser.teamID], "物質", 3),
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("物質")) {
                  applyBuff(monster, { castleDefUp: { strength: 0.3, divineDispellable: true, duration: 3 } });
                  await sleep(100);
                }
              }
            },
          },
        ],
      },
    },

    golem: {
      initialAbilities: [
        {
          name: "物質衆のまもり",
          act: async function (skillUser) {
            if (hasEnoughMonstersOfType(parties[skillUser.teamID], "物質", 4)) {
              applyBuff(skillUser, { martialBarrier: { strength: 2 } });
            } else {
              applyBuff(skillUser, { martialBarrier: { strength: 1 } });
            }
          },
        },
      ],
      afterActionHealAbilities: [
        {
          name: "超回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.HP * 0.2);
          },
        },
      ],
    },
    kinmimi: {
      deathAbilities: [
        {
          name: "ふくしゅうの呪い",
          unavailableIf: (skillUser) => parties[skillUser.teamID].every((monster) => monster.flags.isDead && !monster.flags.reviveNextTurn && !monster.flags.waitingForRevive),
          finalAbility: true,
          isOneTimeUse: true,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (Math.random() < 0.23) {
                await reviveMonster(monster, 0.25, false, true); // 間隔skip
              } else {
                displayMiss(monster);
              }
            }
            await sleep(440);
          },
        },
      ],
    },
    dirtydoll: {
      deathAbilities: [
        {
          name: "ふくしゅうの呪い",
          unavailableIf: (skillUser) => parties[skillUser.teamID].every((monster) => monster.flags.isDead && !monster.flags.reviveNextTurn && !monster.flags.waitingForRevive),
          finalAbility: true,
          isOneTimeUse: true,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              if (Math.random() < 0.23) {
                await reviveMonster(monster, 0.25, false, true); // 間隔skip
              } else {
                displayMiss(monster);
              }
            }
            await sleep(440);
          },
        },
      ],
    },
    skullspider: {
      initialAbilities: [
        {
          name: "亡者の怨嗟・鏡",
          disableMessage: true,
          act: async function (skillUser) {
            skillUser.flags.zombieProbability = 1;
            skillUser.flags.zombifyActName = "亡者の怨嗟・鏡";
          },
        },
      ],
      initialAttackAbilities: [
        {
          name: "汚毒の巣",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の特性`, "汚毒の巣 が発動！");
          },
          act: function (skillUser) {
            for (const monster of parties[skillUser.enemyTeamID]) {
              applyBuff(monster, { poisoned: { isLight: true }, poisonDepth: { keepOnDeath: true, strength: 3 } }, skillUser);
            }
          },
        },
      ],
      zombifyAct: async function (monster, zombifyActName) {
        if (zombifyActName === "亡者の怨嗟・鏡") {
          applyBuff(monster, { slashReflection: { strength: 1, removeAtTurnStart: true, duration: 1, isKanta: true, skipReflectionEffect: true, zombieBuffable: true } });
        }
      },
    },
    barazon: {
      initialAbilities: [
        {
          name: "屍衆の怨霊",
          disableMessage: true,
          act: async function (skillUser) {
            if (hasEnoughMonstersOfType(parties[skillUser.teamID], "ゾンビ", 5)) {
              skillUser.flags.zombieProbability = 1;
              skillUser.flags.isUnAscensionable = true;
            }
          },
        },
        {
          name: "ネクロゴンド変更",
          disableMessage: true,
          act: async function (skillUser) {
            if (!hasEnoughMonstersOfType(parties[skillUser.teamID], "ゾンビ", 5)) {
              skillUser.skill = skillUser.skill.map((name) => {
                if (name === "ネクロゴンドの衝撃") {
                  return "ネクロゴンドの衝撃下位";
                }
                return name;
              });
            }
          },
        },
      ],
      deathAbilities: [
        {
          name: "死への誘い",
          isOneTimeUse: true,
          unavailableIf: (skillUser) => !skillUser.flags.perpetrator,
          act: async function (skillUser) {
            const skillTarget = skillUser.flags.perpetrator;
            applyBuff(skillTarget, { countDown: { count: 2 } });
          },
        },
      ],
    },
    razama: {
      initialAbilities: [
        {
          name: "不滅の王",
          disableMessage: true,
          act: async function (skillUser) {
            skillUser.flags.reviveNextTurn = "不滅の王";
          },
        },
      ],
      supportAbilities: {
        1: [
          {
            name: "一族のうらみ",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("ゾンビ") && monster.name !== "ラザマナス" && !monster.flags.isUnAscensionable) {
                  applyBuff(monster, { zombification: { keepOnDeath: true, removeAtTurnStart: true, duration: 1, iconSrc: "deathAbility" } });
                }
              }
            },
          },
          {
            name: "死者の解放",
            unavailableIf: (skillUser) => {
              parties[skillUser.teamID].some(
                (monster) => monster.abilities && monster.abilities.additionalDeathAbilities && monster.abilities.additionalDeathAbilities.some((ability) => ability.name === "死者の解放")
              );
            },
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("ゾンビ") && monster.name !== "ラザマナス") {
                  monster.abilities.additionalDeathAbilities.push({
                    name: "死者の解放",
                    message: function (skillUser) {
                      displayMessage(`${skillUser.name} がチカラつき`, "死者の解放 の効果が発動！");
                    },
                    act: async function (skillUser) {
                      for (const monster of parties[skillUser.teamID]) {
                        // ラザマ以外に付与 死亡以外(生存or亡者)ならば封じ解除
                        if (monster.race.includes("ゾンビ") && !monster.flags.isDead) {
                          const newBuffs = {};
                          let debuffRemoved = false; // バフが削除されたかどうかを追跡するフラグ
                          const deleteKeys = ["slashSeal", "martialSeal", "spellSeal", "breathSeal", "reviveBlock", "healBlock"];
                          for (const key in monster.buffs) {
                            const value = monster.buffs[key];
                            if (!value.unDispellableByRadiantWave && deleteKeys.includes(key)) {
                              debuffRemoved = true; // 削除フラグ
                            } else {
                              newBuffs[key] = value;
                            }
                          }
                          monster.buffs = newBuffs;
                          if (!debuffRemoved) {
                            displayMiss(monster);
                          } else {
                            await updateMonsterBuffsDisplay(monster);
                          }
                        } else {
                          displayMiss(skillUser);
                        }
                      }
                    },
                  });
                } else {
                  displayMiss(skillUser);
                }
              }
            },
          },
        ],
        2: [
          {
            name: "一族のうらみ",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (monster.race.includes("ゾンビ") && monster.name !== "ラザマナス" && !monster.flags.isUnAscensionable) {
                  applyBuff(monster, { zombification: { keepOnDeath: true, removeAtTurnStart: true, duration: 1, iconSrc: "deathAbility" } });
                }
              }
            },
          },
        ],
      },
    },
    maen: {
      initialAbilities: [
        {
          name: "魔炎のきせき",
          disableMessage: true,
          act: async function (skillUser) {
            skillUser.flags.reviveNextTurn = "魔炎のきせき";
          },
        },
      ],
      deathAbilities: [
        {
          name: "邪悪な残り火",
          isOneTimeUse: true,
          act: async function (skillUser) {
            executeSkill(skillUser, findSkillByName("邪悪な残り火"), null, false, null, false, true, null);
          },
        },
      ],
    },
    kusamaju: {
      initialAbilities: [
        {
          name: "屍獣の執念執念部分",
          disableMessage: true,
          act: async function (skillUser) {
            skillUser.flags.zombieProbability = 1;
          },
        },
      ],
      initialAttackAbilities: [
        {
          name: "毒素拡散",
          unavailableIf: (skillUser) => parties[skillUser.enemyTeamID].some((monster) => monster.abilities.additionalDeathAbilities.some((ability) => ability.name === "毒素拡散")),
          act: async function (skillUser) {
            for (const monster of parties[skillUser.enemyTeamID]) {
              applyBuff(monster, { deathAbility: { keepOnDeath: true } });
              monster.abilities.additionalDeathAbilities.push({
                name: "毒素拡散",
                message: function (skillUser) {
                  displayMessage(`${skillUser.name} がチカラつき`, "毒素拡散 の効果が発動！");
                },
                ignoreSkipDeathAbilityFlag: true, //毒 反射 供物でも実行
                act: async function (skillUser) {
                  for (const monster of parties[skillUser.teamID]) {
                    if (!monster.flags.isDead) {
                      applyBuff(monster, { poisoned: { probability: 1 } });
                      await sleep(150);
                    }
                  }
                },
              });
            }
          },
        },
      ],
      deathAbilities: [
        {
          name: "屍獣の執念",
          act: async function (skillUser) {
            for (const party of parties) {
              for (const monster of party) {
                applyBuff(monster, { defUp: { strength: -1 }, spellBarrier: { strength: -1 }, breathBarrier: { strength: -1 } });
              }
            }
          },
        },
      ],
    },
    desuso: {
      attackAbilities: {
        permanentAbilities: [
          {
            name: "死者のまねき",
            act: function (skillUser) {
              for (const monster of parties[skillUser.enemyTeamID]) {
                applyBuff(monster, { zakiResistance: { strength: -1, iconSrc: "zakiResistancestr-1" } });
              }
            },
          },
        ],
      },
    },
    gorugona: {
      initialAbilities: [
        {
          name: "冥王の瘴気",
          disableMessage: true,
          act: async function (skillUser) {
            skillUser.flags.zombieProbability = 1;
          },
        },
      ],
      deathAbilities: [
        {
          name: "大蜘蛛のあがき",
          isOneTimeUse: true,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.enemyTeamID]) {
              applyBuff(monster, { poisoned: { probability: 0.9 }, spellSeal: { probability: 0.8 } });
            }
          },
        },
      ],
      afterActionHealAbilities: [
        {
          name: "自動HP大回復",
          act: async function (skillUser) {
            applyHeal(skillUser, skillUser.defaultStatus.HP * 0.15);
          },
        },
      ],
    },
    tyomazombie: {
      initialAbilities: [
        {
          name: "死肉の怨嗟",
          disableMessage: true,
          act: async function (skillUser) {
            skillUser.flags.zombieProbability = 1;
            skillUser.flags.zombifyActName = "死肉の怨嗟";
          },
        },
      ],
      afterActionAbilities: [
        {
          name: "超魔の再生力",
          unavailableIf: (skillUser, executingSkill, executedSkills) => executingSkill == null || executingSkill.type === "notskill" || fieldState.turnNum > 5,
          act: async function (skillUser, executingSkill) {
            ascension(skillUser);
            skillUser.currentStatus.MP -= 50;
            if (skillUser.currentStatus.MP < 0) {
              skillUser.currentStatus.MP = 0;
            }
            updateMonsterBar(skillUser);
            await reviveMonster(skillUser, 0.5);
          },
        },
      ],
      zombifyAct: async function (monster, zombifyActName) {
        if (zombifyActName === "死肉の怨嗟") {
          applyBuff(monster, { baiki: { strength: 2, keepOnDeath: true, zombieBuffable: true } });
        }
      },
    },
    gema: {
      initialAbilities: [
        {
          name: "憎悪の怨嗟",
          disableMessage: true,
          act: async function (skillUser) {
            skillUser.flags.zombieProbability = 1;
            skillUser.flags.zombifyActName = "憎悪の怨嗟";
          },
        },
      ],
      supportAbilities: {
        evenTurnAbilities: [
          {
            name: "部下呼び",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
        ],
      },
      zombifyAct: async function (monster, zombifyActName) {
        if (zombifyActName === "憎悪の怨嗟") {
          applyBuff(monster, { paralyzedBreak: { strength: 2, keepOnDeath: true, zombieBuffable: true } });
        }
      },
      followingAbilities: {
        name: "教団の光",
        availableIf: (skillUser, executingSkill) => executingSkill.type === "ritual" && hasEnoughMonstersOfType(parties[skillUser.teamID], "ゾンビ", 2),
        getFollowingSkillName: (executingSkill) => {
          return "光のはどう";
        },
      },
    },
    dokutama: {
      counterAbilities: [
        {
          name: "どくどくボディ",
          act: async function (skillUser, counterTarget) {
            for (const monster of parties[skillUser.enemyTeamID]) {
              applyBuff(monster, { poisoned: {} }, skillUser);
            }
          },
        },
      ],
      deathAbilities: [
        {
          name: "ラストポイズン強",
          isOneTimeUse: true,
          act: async function (skillUser) {
            for (const tempTarget of parties[skillUser.enemyTeamID]) {
              let skillTarget = tempTarget;
              if (skillTarget.flags.hasSubstitute) {
                skillTarget = parties.flat().find((monster) => monster.monsterId === skillTarget.flags.hasSubstitute.targetMonsterId);
              }
              const poisonBuff = hasEnoughMonstersOfType(parties[skillUser.teamID], "ゾンビ", 5) ? { poisoned: { unDispellableByRadiantWave: true } } : { poisoned: {} };
              applyBuff(skillTarget, poisonBuff, skillUser);
            }
          },
        },
      ],
    },
    hazama: {
      initialAbilities: [
        {
          name: "狭間変身条件flag付与",
          disableMessage: true,
          act: async function (skillUser) {
            skillUser.flags.hazamaNeverKilled = true;
          },
        },
      ],
      initialAttackAbilities: [
        {
          name: "光をうばうもの",
          disableMessage: true,
          act: function (skillUser) {
            for (const party of parties) {
              for (const monster of party) {
                if (monster.buffs.revive) {
                  delete monster.buffs.revive;
                  updateMonsterBuffsDisplay(monster);
                }
              }
            }
          },
        },
      ],
      supportAbilities: {
        permanentAbilities: [
          {
            name: "名もなき化身",
            disableMessage: true,
            act: async function (skillUser) {
              await executeRadiantWave(skillUser);
            },
          },
          {
            name: "深淵の衣",
            act: async function (skillUser) {
              const targetBuffs = ["baiki", "defUp", "spdUp", "intUp", "slashBarrier", "spellBarrier", "martialBarrier", "breathBarrier"];
              for (const key of targetBuffs) {
                const buffData = skillUser.buffs[key];
                if (buffData && !buffData.keepOnDeath && buffData.strength === 1) {
                  buffData.strength = 2;
                }
              }
              updateMonsterBuffsDisplay(skillUser);
            },
          },
        ],
      },
      attackAbilities: {
        permanentAbilities: [
          {
            name: "狭間変身",
            disableMessage: true,
            isOneTimeUse: true,
            unavailableIf: (skillUser) => skillUser.flags.hazamaNeverKilled || skillUser.flags.hasTransformed,
            act: async function (skillUser) {
              await transformTyoma(skillUser);
            },
          },
        ],
      },
    },
    garumazzo: {
      initialAbilities: [
        {
          name: "バイオドレイン付与",
          act: async function (skillUser) {
            for (const monster of parties[skillUser.enemyTeamID]) {
              monster.abilities.additionalDeathAbilities.push({
                name: "バイオドレイン", // リザオや変身、反射死で発動しない ただしムンの2回目以降は無限回発動
                message: function (skillUser) {
                  displayMessage(`${skillUser.name} がチカラつき`, "バイオドレイン の効果が発動！");
                },
                finalAbility: true,
                act: async function (skillUser) {
                  for (const monster of parties[skillUser.enemyTeamID]) {
                    if (isBreakMonster(monster)) {
                      const randomMultiplier = Math.floor(Math.random() * 11) * 0.01 + 0.95;
                      applyHeal(monster, 105 * randomMultiplier, false, false); //錬金無視
                    }
                  }
                },
              });
            }
          },
        },
      ],
      attackAbilities: {
        permanentAbilities: [
          {
            name: "魔界の門",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.enemyTeamID]) {
                if (monster.buffs.maso) {
                  if (monster.buffs.maso.strength === 4) {
                    applyBuff(monster, { maso: { strength: 5, maxDepth: 5 }, sealed: {} });
                  } else if (monster.buffs.maso.strength < 3) {
                    applyBuff(monster, { maso: { maxDepth: 3 } });
                  }
                }
              }
            },
          },
        ],
      },
    },
    garumazard: {
      initialAbilities: [
        {
          name: "新たなる神眠り無効",
          disableMessage: true,
          unavailableIf: (skillUser) => countBreakMonster(parties[skillUser.teamID]) < 5,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.teamID]) {
              applyBuff(monster, { garumaBarrier: { keepOnDeath: true }, sleepBarrier: { duration: 3 } });
            }
          },
        },
      ],
      initialAttackAbilities: [
        {
          name: "新たなる神デバフ付与",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の特性`, "新たなる神 の効果が敵に発動！");
          },
          unavailableIf: (skillUser) => countBreakMonster(parties[skillUser.teamID]) < 5,
          act: async function (skillUser) {
            for (const monster of parties[skillUser.enemyTeamID]) {
              applyBuff(monster, { baiki: { strength: -1 }, intUp: { strength: -1 }, spellBarrier: { strength: -1 } });
            }
          },
        },
      ],
      supportAbilities: {
        1: [
          {
            name: "星のオーラ",
            message: function (skillUser) {
              displayMessage(`${skillUser.name}の特性により`, "MP継続回復効果 が発動！");
            },
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (isBreakMonster(monster)) {
                  applyBuff(monster, { continuousMPHealing: { removeAtTurnStart: true, duration: 5 } }); //回復量50
                }
              }
            },
          },
        ],
      },
      attackAbilities: {
        evenTurnAbilities: [
          {
            name: "ブレイクシステム",
            act: async function (skillUser) {
              await executeSkill(skillUser, findSkillByName("ブレイクシステム"), null, false, null, false, true, null);
            },
          },
        ],
      },
    },
    buon: {
      supportAbilities: {
        permanentAbilities: [
          {
            name: "ブレイクアーマー",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (isBreakMonster(monster)) {
                  applyBuff(monster, { slashBarrier: { strength: 1 } });
                  await sleep(100);
                  applyBuff(monster, { spellBarrier: { strength: 1 } });
                  await sleep(100);
                }
              }
            },
          },
        ],
      },
    },
    ultrametakin: {
      supportAbilities: {
        evenTurnAbilities: [
          {
            name: "マ素供給",
            act: async function (skillUser) {
              for (const monster of parties[skillUser.teamID]) {
                if (isBreakMonster(monster)) {
                  const randomMultiplier = Math.floor(Math.random() * 11) * 0.01 + 0.95;
                  applyHeal(monster, 110 * randomMultiplier, false, false); //錬金無視
                }
              }
            },
          },
        ],
      },
      counterAbilities: [
        {
          name: "凶メタルボディ",
          act: async function (skillUser, counterTarget) {
            applyBuff(counterTarget, { spdUp: { strength: -1 } }, skillUser);
          },
        },
      ],
    },
    smetakin: {
      counterAbilities: [
        {
          name: "凶メタルボディ",
          act: async function (skillUser, counterTarget) {
            applyBuff(counterTarget, { spdUp: { strength: -1 } }, skillUser);
          },
        },
      ],
    },
  };

  return monsterAbilities[monsterId] || {};
}

const skill = [
  {
    name: "sample",
    displayName: "hoge", //任意 ある場合はこちらがdisplayされる
    id: "number?",
    type: "", //spell slash martial breath ritual notskill
    howToCalculate: "", //atk int fix def spd MP
    fixedDamage: true, // 完全固定ダメージ ボンスキュ反撃 紅蓮剣 星皇 アルテマ誇り エクスカリパー 針10本 ミルスト ブラジョ 屍大狂乱 キャスリング
    ratio: 1,
    MPdamageRatio: 1.5,
    damage: 142,
    damageMultiplierBySameRace: true,
    minInt: 500,
    minIntDamage: 222,
    maxInt: 1000,
    maxIntDamage: 310,
    skillPlus: 1.15,
    element: "", //fire ice thunder io wind light dark
    targetType: "", //single random all self field dead
    targetTeam: "enemy", //ally enemy
    excludeTarget: (targetMonster) => !targetMonster.race.includes("物質"),
    hitNum: 3,
    MPcost: 76,
    MPcostRatio: 1, // 現在MPに対するその割合(切り捨て)だけ消費 全消費は1
    order: "", //preemptive anchor
    preemptiveGroup: 3, //1封印の霧,邪神召喚,error 2マイバリ精霊タップ 3におう 4みがわり 5予測構え 6ぼうぎょ 7全体 8random単体
    isOneTimeUse: true,
    isHealSkill: true,
    skipDeathCheck: true, // 死亡時 isDeadでも常に実行
    isCounterSkill: true, // 反撃 isDeadでは実行しない　両方ともskipThisTurnは無視
    skipSkillSealCheck: true,
    weakness18: true,
    criticalHitProbability: 1, //noSpellSurgeはリスト管理
    missProbability: 0.3,
    RaceBane: ["スライム", "ドラゴン"],
    RaceBaneValue: 3,
    anchorBonus: 3,
    damageByLevel: true,
    substituteBreaker: 3,
    ignoreProtection: true,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreGuard: true,
    ignoreEvasion: true,
    ignoreTypeEvasion: true,
    ignoreDazzle: true,
    penetrateStoned: true,
    ignoreBaiki: true,
    ignoreManaBoost: true,
    ignorePowerCharge: true,
    ignoreBarrier: true,
    damageByHpPercent: true,
    lowHpDamageMultiplier: true,
    specialMessage: function (skillUserName, skillName) {
      displayMessage(`${skillUserName}は闇に身をささげた！`);
    },
    followingSkill: "涼風一陣後半",
    additionalVersion: "追加用咆哮",
    appliedEffect: { defUp: { strength: -1 } }, //radiantWave divineWave disruptiveWave
    zakiProbability: 0.78,
    absorptionRatio: 0.5,
    act: function (skillUser, skillTarget) {
      console.log("hoge");
    },
    alwaysAct: true,
    afterActionAct: async function (skillUser) {
      console.log("hoge"); //missとかにかかわらず、一回だけ実行するact 死亡していても実行 行動skip判定前
    },
    selfAppliedEffect: async function (skillUser) {
      console.log("hoge"); //missとかにかかわらず、一回だけ実行するact 行動skipされる可能性あり
    },
    damageModifier: function (skillUser, skillTarget) {
      return Math.pow(1.6, power) - 1;
    },
    damageMultiplier: function (skillUser, skillTarget, isReflection) {
      return 2; //初期値は1
    },
    abnormalityMultiplier: function (skillUser, skillTarget) {
      return 2; //初期値は1 状態異常特効系 マソと競合
    },
    masoMultiplier: {
      1: 2,
      2: 3,
      3: 4,
      4: 5,
    },
    unavailableIf: (skillUser) => skillUser.flags.isSubstituting || skillUser.flags.hasSubstitute,
    reviseIf: function (skillUser) {
      if (!hasEnoughMonstersOfType(parties[skillUser.teamID], "魔獣", 3)) {
        return "ツイスター下位";
      }
    },
    discription1: "hoge", //property部分
    discription2: "hoge",
    discription3: "hoge",
  },
  {
    name: "通常攻撃",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 1,
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "通常攻撃ザキ攻撃",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 1,
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    zakiProbability: 0.6,
  },
  {
    name: "昇天槍攻撃",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 1,
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    followingSkill: "昇天槍昇天部分",
  },
  {
    name: "昇天槍昇天部分",
    type: "notskill",
    howToCalculate: "none",
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreReflection: true,
    act: function (skillUser, skillTarget) {
      ascension(skillTarget);
    },
  },
  {
    name: "心砕き攻撃",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 0.33,
    element: "notskill",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 0,
    act: async function (skillUser, skillTarget) {
      if (skillTarget.buffs.isUnbreakable && !skillTarget.buffs.isUnbreakable.isToukon && !skillTarget.flags.isZombie) {
        //防壁などによる失敗はないので、通常攻撃成功時はactも100%実行
        displayMessage("そうびの特性により", "くじけぬ心が ゆらいだ！");
        skillTarget.buffs.isUnbreakable.left = 1;
        skillTarget.buffs.isUnbreakable.isToukon = true; //処理用
        skillTarget.buffs.isUnbreakable.isBroken = true; //アイコン変更用
        // await updateMonsterBuffsDisplay(skillTarget);
      }
    },
  },
  {
    name: "一族のけがれ攻撃",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 0.33,
    element: "notskill",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 0,
    appliedEffect: { poisoned: { probability: 0.9 } },
    act: function (skillUser, skillTarget) {
      intensityPoisonDepth(skillTarget);
    },
  },
  {
    name: "はやぶさ攻撃弱",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 0.55,
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 2,
    MPcost: 0,
  },
  {
    name: "おうごんのツメ攻撃",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 1,
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned || skillTarget.buffs.asleep || skillTarget.buffs.paralyzed) {
        return 2.5;
      }
    },
    masoMultiplier: {
      1: 2.5,
      2: 2.6, // 推測
      3: 2.7,
      4: 2.8,
    },
  },
  {
    name: "ハザードネイル攻撃",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 1,
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: { maso: { maxDepth: 4 } },
  },
  {
    name: "通常攻撃アイアンヒット",
    type: "notskill",
    howToCalculate: "def",
    ratio: 0.9,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreDazzle: true,
    criticalHitProbability: 0,
  },
  {
    name: "会心通常攻撃",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 1,
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    criticalHitProbability: 1,
  },
  {
    name: "魔獣の追撃",
    type: "notskill",
    howToCalculate: "spd",
    ratio: 0.6,
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "通常攻撃時くじけぬ心を解除",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 1,
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "防御力依存攻撃",
    type: "notskill",
    howToCalculate: "def",
    ratio: 0.45,
    element: "notskill",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "アサルトシステム",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 0.25,
    element: "notskill",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 0,
  },
  {
    name: "イオ系攻撃",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 1,
    element: "io",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "絶大な力",
    type: "notskill",
    howToCalculate: "atk",
    ratio: 0.2,
    element: "notskill",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 0,
    ignoreReflection: true,
    ignoreProtection: true,
  },
  {
    name: "アバン通常攻撃息",
    specialMessage: function (skillUserName, skillName) {
      displayMessage(`${skillUserName}の攻撃！`);
    },
    type: "breath",
    howToCalculate: "fix",
    damage: 200,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 0,
    ignoreReflection: true,
  },
  {
    name: "ぼうぎょ",
    type: "notskill",
    howToCalculate: "none",
    element: "notskill",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 0,
    order: "preemptive",
    preemptiveGroup: 6,
    act: function (skillUser, skillTarget) {
      skillUser.flags.guard = true;
    },
  },
  {
    name: "会心撃",
    type: "martial",
    howToCalculate: "atk",
    ratio: 1,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 110,
    criticalHitProbability: 1,
    ignoreEvasion: true,
    ignoreBaiki: true,
    ignorePowerCharge: true,
  },
  {
    name: "超魔神斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.49,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    order: "anchor",
    MPcost: 85,
    criticalHitProbability: 1,
    ignoreBaiki: true,
    ignorePowerCharge: true,
  },
  {
    name: "魔神斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    criticalHitProbability: 0.5, //miss4割以外の6割の半分
    missProbability: 0.4,
    ignoreBaiki: true,
    ignorePowerCharge: true,
  },
  {
    name: "涼風一陣",
    type: "martial",
    howToCalculate: "fix",
    damage: 142,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 96,
    followingSkill: "涼風一陣後半",
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
    discription1: "敵全体に【みかわし不可】【マヌーサ無効】でヒャド系体技",
    discription2: "その後　敵全体に【軽減無視】で無属性息　どちらか命中時",
    discription3: "くじけぬ心解除　後半はドラゴン系の味方が多いほど威力大",
  },
  {
    name: "涼風一陣後半",
    type: "breath",
    howToCalculate: "fix",
    damage: 84, //420
    damageMultiplierBySameRace: true,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreProtection: true,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "神楽の術",
    type: "spell",
    howToCalculate: "int",
    minInt: 500,
    minIntDamage: 222,
    maxInt: 1000,
    maxIntDamage: 310,
    skillPlus: 1.15,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 65,
    substituteBreaker: 3,
    appliedEffect: "divineWave",
    reviseIf: function (skillUser) {
      if (!hasEnoughMonstersOfType(parties[skillUser.teamID], "ドラゴン", 5)) {
        return "神楽の術下位";
      }
    },
    discription1: "敵全体に　無属性の呪文攻撃",
    discription2: "命中時　状態変化解除　みがわり状態の敵に　威力3倍",
    discription3: "ドラゴン系の味方が5体以上なら　状態変化解除が上位効果",
  },
  {
    name: "神楽の術下位",
    displayName: "神楽の術",
    type: "spell",
    howToCalculate: "int",
    minInt: 500,
    minIntDamage: 222,
    maxInt: 1000,
    maxIntDamage: 310,
    skillPlus: 1.15,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 65,
    substituteBreaker: 3,
    appliedEffect: "disruptiveWave",
  },
  {
    name: "昇天斬り",
    type: "slash",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 35,
    appliedEffect: { zombifyBlock: { removeAtTurnStart: true, duration: 1 } },
    act: function (skillUser, skillTarget) {
      ascension(skillTarget);
    },
    followingSkill: "昇天斬り後半",
  },
  {
    name: "昇天斬り後半",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.74,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "タップダンス",
    type: "dance",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 30,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { dodgeBuff: { strength: 0.5 } },
    discription1: "【先制】1ターンの間　味方全体の　みかわし率を50%にする",
  },
  {
    name: "氷華大繚乱",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "ice",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 65,
    ignoreReflection: true,
    appliedEffect: { iceResistance: { strength: -1, probability: 0.57 } },
  },
  {
    name: "フローズンシャワー",
    type: "martial",
    howToCalculate: "fix",
    damage: 190,
    element: "ice",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 7, //todo: 回数
    MPcost: 70,
    order: "anchor",
    ignoreProtection: true,
    ignoreReflection: true,
    discription1: "【アンカー】【みかわし不可】【マヌーサ無効】",
    discription2: "【反射無視】【軽減無視】",
    discription3: "敵1体に7回　ヒャド系の体技攻撃",
  },
  {
    name: "おぞましいおたけび",
    type: "martial",
    howToCalculate: "atk",
    ratio: 1.4,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 65,
    criticalHitProbability: 0,
    ignoreDazzle: true,
    ignoreBaiki: true,
    appliedEffect: { confused: { probability: 0.2329 }, fear: { probability: 0.2792 } },
  },
  {
    name: "スパークふんしゃ",
    type: "breath",
    howToCalculate: "fix",
    damage: 230,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 58,
    appliedEffect: "disruptiveWave",
    discription2: "ランダムに5回　ギラ系の息攻撃",
    discription3: "命中時　状態変化解除",
  },
  {
    name: "サンダーボルト",
    type: "martial",
    howToCalculate: "fix",
    damage: 240,
    element: "thunder",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 78,
    damageByLevel: true,
  },
  {
    name: "パニッシュメント",
    type: "martial",
    howToCalculate: "fix",
    damage: 240,
    element: "light",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 78,
    damageByLevel: true,
  },
  {
    name: "天地雷鳴",
    type: "martial",
    howToCalculate: "fix",
    damage: 315,
    element: "thunder",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 98,
    damageByLevel: true,
  },
  {
    name: "偽りの秘剣",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.15,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 30,
    RaceBane: ["???", "自然"],
    RaceBaneValue: 3,
    ignoreEvasion: true,
  },
  {
    name: "天空竜の息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 184,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 48,
    ignoreProtection: true,
  },
  {
    name: "エンドブレス",
    type: "breath",
    howToCalculate: "fix",
    damage: 100,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 500,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreGuard: true,
    damageModifier: function (skillUser, skillTarget) {
      const power = skillUser.buffs.dragonPreemptiveAction?.strength ?? 0;
      return Math.pow(1.6, power) - 1;
    },
    afterActionAct: async function (skillUser) {
      delete skillUser.buffs.dragonPreemptiveAction;
    },
    discription2: "天の竜気レベルを全て消費し　敵全体に　無属性の息攻撃",
    discription3: "使用時の天の竜気レベルが高いほど　威力大",
  },
  {
    name: "テンペストブレス",
    type: "breath",
    howToCalculate: "fix",
    damage: 369,
    element: "wind",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 47,
  },
  {
    name: "煉獄火炎",
    type: "breath",
    howToCalculate: "fix",
    damage: 333,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 136,
    appliedEffect: { fear: { probability: 0.213 } },
  },
  {
    name: "はげしい炎", //searchとくぎレベルアップ調査から
    type: "breath",
    howToCalculate: "fix",
    damage: 142,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 55,
  },
  {
    name: "グランブレス",
    type: "breath",
    howToCalculate: "fix",
    damage: 260,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 150,
    ignoreReflection: true,
  },
  {
    name: "むらくもの息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 140,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 70,
    appliedEffect: { murakumo: { dispellableByRadiantWave: true, duration: 3 } },
  },
  {
    name: "獄炎の息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 230,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 60,
    weakness18: true,
  },
  {
    name: "ほとばしる暗闇",
    type: "martial",
    howToCalculate: "fix",
    damage: 162,
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 82,
    damageByLevel: true,
    appliedEffect: "disruptiveWave",
    act: function (skillUser, skillTarget) {
      delete skillTarget.buffs.powerCharge;
      delete skillTarget.buffs.manaBoost;
      delete skillTarget.buffs.breathCharge;
    },
  },
  {
    name: "ダイヤモンドダスト",
    type: "breath",
    howToCalculate: "fix",
    damage: 215,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 64,
    appliedEffect: { asleep: { probability: 0.58 } },
  },
  {
    name: "防刃の守り",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 54,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { slashBarrier: { strength: 1 }, protection: { strength: 0.2, duration: 2, removeAtTurnStart: true } },
    discription1: "【先制】味方全体の　斬撃防御を1段階上げ",
    discription2: "2ターンの間　ダメージ20%軽減状態にする",
  },
  {
    name: "ダメージバリア",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 37,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { protection: { strength: 0.2, duration: 2, removeAtTurnStart: true } },
  },
  {
    name: "聖騎士の守護",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 54,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { mindBarrier: { duration: 3 }, protection: { strength: 0.2, duration: 2, removeAtTurnStart: true, probability: 0.567 } },
  },
  {
    name: "五連竜牙弾",
    type: "martial",
    howToCalculate: "fix",
    damage: 150,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 45,
    damageByLevel: true,
    appliedEffect: { fear: { probability: 0.18 } }, // 推測確率
  },
  {
    name: "オーロラブレス",
    type: "breath",
    howToCalculate: "fix",
    damage: 264,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 136,
  },
  {
    name: "ハッピーブレス",
    type: "breath",
    howToCalculate: "fix",
    damage: 195,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 65,
    appliedEffect: { tempted: { probability: 0.4 } },
  },
  {
    name: "ラヴァフレア",
    type: "breath",
    howToCalculate: "fix",
    damage: 243,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    order: "anchor",
    hitNum: 3,
    MPcost: 76,
    anchorBonus: 3,
    ignoreProtection: true,
  },
  {
    name: "におうだち",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 14,
    order: "preemptive",
    preemptiveGroup: 3,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, null, true);
    },
    selfAppliedEffect: async function (skillUser) {
      if (skillUser.gear?.name === "天空の衣") {
        await sleep(100);
        applyBuff(skillUser, { protection: { strength: 0.2, duration: 1, removeAtTurnStart: true } });
      }
    },
    unavailableIf: (skillUser) => skillUser.flags.isSubstituting || skillUser.flags.hasSubstitute,
    discription1: "【先制】味方全体への　敵の行動を　かわりにうける",
  },
  {
    name: "特性発動用におうだち",
    type: "ritual", //封じ無効
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 0,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, null, true);
    },
    unavailableIf: (skillUser) => skillUser.flags.isSubstituting || skillUser.flags.hasSubstitute,
  },
  {
    name: "大樹の守り",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 79,
    order: "preemptive",
    preemptiveGroup: 2,
    isOneTimeUse: true,
    appliedEffect: { protection: { strength: 0.5, duration: 2, removeAtTurnStart: true } },
  },
  {
    name: "みがわり",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 5,
    order: "preemptive",
    preemptiveGroup: 4,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, skillTarget);
    },
    selfAppliedEffect: async function (skillUser) {
      if (skillUser.gear?.name === "天空の衣") {
        await sleep(100);
        applyBuff(skillUser, { protection: { strength: 0.2, duration: 1, removeAtTurnStart: true } });
      }
    },
    unavailableIf: (skillUser) => skillUser.flags.isSubstituting || skillUser.flags.hasSubstitute,
    discription1: "【先制】味方1体への　敵の行動を　かわりにうける",
  },
  {
    name: "みがわり・マインドバリア",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 11,
    order: "preemptive",
    preemptiveGroup: 4,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, skillTarget);
    },
    selfAppliedEffect: async function (skillUser) {
      await sleep(100);
      applyBuff(skillUser, { mindBarrier: { duration: 4 } });
    },
    unavailableIf: (skillUser) => skillUser.flags.isSubstituting || skillUser.flags.hasSubstitute,
    discription1: "【先制】味方全体への　敵の行動を　かわりにうける",
    discription2: "自分を　行動停止無効状態にする",
  },
  {
    name: "アルマゲスト",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 178,
    maxInt: 600,
    maxIntDamage: 410,
    skillPlus: 1.15,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 108,
    ignoreProtection: true,
    ignoreGuard: true,
  },
  {
    name: "しのルーレット",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 244,
    order: "preemptive",
    preemptiveGroup: 7,
    ignoreSubstitute: true,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    act: function (skillUser, skillTarget) {
      skillUser.abilities.attackAbilities.nextTurnAbilities.push({
        name: "しのルーレット",
        message: function (skillUser) {
          displayMessage("しのルーレットの 効果が発動！");
        },
        unavailableIf: (skillUser) => skillUser.buffs.martialSeal,
        act: async function (skillUser) {
          const aliveEnemies = parties[skillUser.enemyTeamID].filter((monster) => !monster.flags.isDead);
          if (aliveEnemies.length > 0) {
            const zakiTarget = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
            if (!zakiTarget.flags.isZombie) {
              handleDeath(zakiTarget, false, true, null, true); // isCountDownをtrue
              displayMessage(`${zakiTarget.name}の`, "いきのねをとめた!!");
              await checkRecentlyKilledFlagForPoison(zakiTarget);
            }
          }
        },
      });
    },
  },
  {
    name: "タイダルウェイブ",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 195,
    maxInt: 600,
    maxIntDamage: 315,
    skillPlus: 1.15,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 98,
    appliedEffect: "disruptiveWave",
  },
  {
    name: "ほのお",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 390,
    maxInt: 600,
    maxIntDamage: 750,
    skillPlus: 1.15,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 88,
    ignoreProtection: true,
    ignoreGuard: true,
  },
  {
    name: "メテオ",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 100,
    maxInt: 600,
    maxIntDamage: 220,
    skillPlus: 1.15,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 70,
    ignoreReflection: true,
  },
  //"しのルーレット"
  {
    name: "真・ハーケンディストール",
    type: "slash",
    howToCalculate: "fix",
    damage: 86,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 120,
    RaceBane: ["物質"],
    RaceBaneValue: 2, // みかわし マヌーサ有効
  },
  {
    name: "真・閃光さみだれ突き",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 56,
    ignoreEvasion: true,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.fear || skillTarget.buffs.tempted || skillTarget.buffs.sealed || skillTarget.buffs.asleep || skillTarget.buffs.paralyzed) {
        return 1.5;
      }
    },
  },
  {
    name: "アバンストラッシュ",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.72,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 35,
    RaceBane: ["???"],
    RaceBaneValue: 3,
  },
  {
    name: "アバンストラッシュ反撃", // みがわり無視
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.72,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 35,
    ignoreSubstitute: true,
    isCounterSkill: true,
    RaceBane: ["???"],
    RaceBaneValue: 3,
  },
  {
    name: "空裂斬",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.72,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    order: "preemptive",
    preemptiveGroup: 8,
    ignoreEvasion: true,
  },
  {
    name: "海波斬",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.09,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 69,
    appliedEffect: "divineWave",
  },
  {
    name: "大地斬",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.09,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 67,
    appliedEffect: { fear: { probability: 0.4278 } },
  },
  {
    name: "アンカーナックル",
    type: "martial",
    howToCalculate: "atk",
    ratio: 1.4,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 33,
    order: "anchor",
    anchorBonus: 3,
    ignoreEvasion: true,
    ignoreDazzle: true,
  },
  {
    name: "黒くかがやく闇",
    type: "breath",
    howToCalculate: "fix",
    damage: 295,
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 124,
  },
  {
    name: "超魔滅光",
    type: "martial",
    howToCalculate: "fix",
    damage: 475,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 78,
    RaceBane: ["???", "超魔王"],
    RaceBaneValue: 4,
    damageByLevel: true,
    followingSkill: "超魔滅光後半",
    discription1: "【みかわし不可】【マヌーサ無効】敵1体に　レベル依存で",
    discription2: "無属性の体技攻撃　その後敵全体に　レベル依存で",
    discription3: "無属性の体技攻撃　???・超魔王系の敵に　威力4倍",
  },
  {
    name: "超魔滅光後半",
    type: "martial",
    howToCalculate: "fix",
    damage: 200,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    RaceBane: ["???", "超魔王"],
    RaceBaneValue: 4,
    damageByLevel: true,
  },
  {
    name: "真・ゆうきの斬舞",
    type: "dance",
    howToCalculate: "atk",
    ratio: 0.91,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 71,
    order: "preemptive",
    preemptiveGroup: 8,
    criticalHitProbability: 0,
    ignoreDazzle: true,
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      applyBuff(skillUser, { baiki: { strength: 1 }, spdUp: { strength: 1 } });
    },
    discription2: "ランダムに6回　攻撃力依存で　デイン系の踊り攻撃",
    discription3: "その後　自分の攻撃力・素早さを1段階上げる",
  },
  {
    name: "神獣の封印",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 34,
    isOneTimeUse: true,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    appliedEffect: { sealed: { zombieBuffable: true } },
  },
  {
    name: "ソウルハーベスト",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 9,
    MPcost: 58,
    ignoreReflection: true,
    appliedEffect: { reviveBlock: { duration: 1 } },
  },
  {
    name: "黄泉の封印",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 39,
    isOneTimeUse: true,
    appliedEffect: { sealed: { zombieBuffable: true }, reviveBlock: { unDispellableByRadiantWave: true } },
    discription2: "1ターンの間　敵1体を　封印状態にし　命中時",
    discription3: "ラウンド数制限なしで　解除不可の蘇生封じ状態にする",
  },
  {
    name: "暗黒閃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 3.6,
    element: "dark",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 43,
    order: "preemptive",
    preemptiveGroup: 8,
    ignoreEvasion: true,
  },
  {
    name: "冥王の奪命鎌",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.12,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 52,
    substituteBreaker: 3,
    ignoreEvasion: true,
    zakiProbability: 0.78,
    discription1: "【みかわし不可】敵全体に　攻撃力依存で",
    discription2: "無属性の斬撃攻撃　確率で即死させる",
    discription3: "みがわり状態の敵に　威力3倍",
  },
  {
    name: "終の流星",
    type: "martial",
    howToCalculate: "fix",
    damage: 580,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 79,
    order: "anchor",
    ignoreProtection: true,
    ignoreReflection: true,
    discription1: "【アンカー】【みかわし不可】【マヌーサ無効】",
    discription2: "【反射無視】【軽減無視】",
    discription3: "ランダムに6回　無属性の体技攻撃",
  },
  {
    name: "暴獣の右ウデ",
    type: "martial",
    howToCalculate: "fix",
    damage: 380,
    element: "dark",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 54,
    appliedEffect: "divineWave",
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      applyBuff(skillUser, { martialEvasion: { duration: 2, divineDispellable: true } });
    },
    discription1: "【みかわし不可】【マヌーサ無効】ランダムに4回",
    discription2: "ドルマ系の体技攻撃　命中時　状態変化解除（上位効果）",
    discription3: "その後　2ターンの間　自分を　体技無効状態にする",
  },
  {
    name: "供物をささげる",
    type: "ritual",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 0,
    specialMessage: function (skillUserName, skillName) {
      displayMessage(`${skillUserName}は闇に身をささげた！`);
    },
    act: function (skillUser, skillTarget) {
      // skipDeathAbility: trueでhandleDeath
      handleDeath(skillUser, true, true, null);
      skillUser.skill[3] = skillUser.defaultSkill[3];
    },
    followingSkill: "供物をささげる死亡",
  },
  {
    name: "供物をささげる死亡",
    type: "ritual",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 0,
    skipDeathCheck: true,
    act: async function (skillUser, skillTarget) {
      const nerugeru = parties[skillUser.teamID].find((member) => member.id === "nerugeru");
      if (!nerugeru.flags.isDead && !nerugeru.flags.hasTransformed) {
        // 生存かつ未変身の場合、リザオ有無にかわらずネルを一度落とす
        delete nerugeru.buffs.reviveBlock;
        delete nerugeru.buffs.healBlock;
        delete nerugeru.buffs.poisonDepth;
        delete nerugeru.buffs.stoned;
        delete nerugeru.buffs.maso; // マソ深度5も解除
        // リザオ予定ではない場合、変身許可
        if (!nerugeru.buffs.revive) {
          nerugeru.flags.willTransformNeru = true;
        }
        // skipDeathAbility: trueでhandleDeath
        // ラス1で供物死後にisDead判定されてbattleoverになるのを防ぐ 変身時削除
        nerugeru.flags.waitingForRevive = true;
        handleDeath(nerugeru, true, true, null);
      }
    },
    followingSkill: "供物をささげる変身",
  },
  {
    name: "供物をささげる変身",
    type: "ritual",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 0,
    skipDeathCheck: true,
    act: async function (skillUser, skillTarget) {
      const nerugeru = parties[skillUser.teamID].find((member) => member.id === "nerugeru");
      if (nerugeru.flags.willTransformNeru) {
        delete nerugeru.flags.willTransformNeru;
        for (const monster of parties[skillUser.teamID]) {
          monster.skill[3] = monster.defaultSkill[3];
        }
        await sleep(200);
        await reviveMonster(nerugeru, 1, true, true, true);
        delete nerugeru.flags.waitingForRevive;
        await transformTyoma(nerugeru);
      }
    },
  },
  {
    name: "冥王の構え",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 5,
    MPcost: 22,
    specialMessage: function (skillUserName, skillName) {
      displayMessage(`${skillUserName}は`, "攻撃に対して 反撃する状態になった！");
    },
    appliedEffect: { counterAttack: { keepOnDeath: true, divineDispellable: true, decreaseTurnEnd: true, duration: 1 } },
    act: function (skillUser, skillTarget) {
      skillUser.abilities.additionalCounterAbilities = [
        {
          name: "冥王の構え反撃状態",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の 反撃！`);
          },
          unavailableIf: (skillUser) => !skillUser.buffs.counterAttack,
          act: async function (skillUser, counterTarget) {
            await executeSkill(skillUser, findSkillByName("冥王の構え反撃"), counterTarget);
          },
        },
      ];
    },
  },
  {
    name: "冥王の構え反撃",
    type: "slash",
    howToCalculate: "fix",
    fixedDamage: true,
    damage: 50,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreEvasion: true, // マヌーサ有効
    isCounterSkill: true,
    specialMessage: function (skillUserName, skillName) {
      displayMessage(`${skillUserName}の 反撃！`);
    },
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "グレイトアックス反撃",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 66,
    maxInt: 200,
    maxIntDamage: 140,
    skillPlus: 1,
    element: "io",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreSubstitute: true,
    isCounterSkill: true,
    specialMessage: function (skillUserName, skillName) {
      displayMessage(`${skillUserName}の 反撃！`);
    },
  },
  {
    name: "失望の光舞",
    type: "dance",
    howToCalculate: "fix",
    damage: 210,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 65,
    appliedEffect: "disruptiveWave",
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "絶望の天舞",
    type: "dance",
    howToCalculate: "fix",
    damage: 210,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 75,
    appliedEffect: "divineWave",
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "パニッシュスパーク",
    type: "martial",
    howToCalculate: "fix",
    damage: 310,
    element: "thunder",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 92,
    appliedEffect: "divineWave",
    act: function (skillUser, skillTarget) {
      applyBuff(skillTarget, { slashSeal: {} });
    },
    discription1: "【みかわし不可】【マヌーサ無効】敵全体に",
    discription2: "ギラ系の体技攻撃　命中時　状態変化解除（上位効果）",
    discription3: "その後　敵全体を　ギラ系の体技で斬撃封じ状態にする",
  },
  {
    name: "堕天使の理",
    type: "dance",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 50,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { dodgeBuff: { strength: 1 }, spdUp: { strength: 1 } },
    discription2: "1ターンの間　味方全体の　みかわし率を100%にし",
    discription3: "素早さを1段階上げる",
  },
  {
    name: "光速の連打",
    type: "martial",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 51,
    ignoreEvasion: true,
    appliedEffect: { lightResistance: { strength: -1, probability: 0.57 } },
  },
  {
    name: "ヘルバーナー",
    type: "martial",
    howToCalculate: "fix",
    damage: 891,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 74,
    ignoreSubstitute: true,
  },
  {
    name: "氷魔のダイヤモンド",
    type: "breath",
    howToCalculate: "fix",
    damage: 891,
    element: "ice",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 74,
    ignoreSubstitute: true,
  },
  {
    name: "炎獣の爪",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.15,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 30,
    order: "preemptive",
    preemptiveGroup: 8,
    RaceBane: ["ドラゴン", "???"],
    RaceBaneValue: 2,
  },
  {
    name: "アイスエイジ",
    type: "martial",
    howToCalculate: "fix",
    damage: 230,
    element: "ice",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 0,
    appliedEffect: { martialBarrier: { strength: -1, probability: 0.387 } },
  },
  {
    name: "地獄の火炎",
    type: "breath",
    howToCalculate: "fix",
    damage: 230,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 0,
    appliedEffect: { fireResistance: { strength: -1, probability: 0.58 } },
  },
  {
    name: "真・氷魔の力",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 48,
    appliedEffect: "disruptiveWave",
    followingSkill: "真・氷魔の力後半",
  },
  {
    name: "真・氷魔の力後半",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreReflection: true,
    appliedEffect: { martialBarrier: { strength: -1 }, breathBarrier: { strength: -1 } },
    act: function (skillUser, skillTarget) {
      applyBuff(skillTarget, { martialBarrier: { strength: -1, probability: 0.4 }, breathBarrier: { strength: -1, probability: 0.4 } });
    },
  },
  {
    name: "プリズムヴェール",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 54,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { prismVeil: { strength: 1, duration: 3 } },
    discription2: "3ラウンドの間　味方全体の",
    discription3: "全属性耐性（状態異常以外）を1ランク上げる",
  },
  {
    name: "雷電波",
    type: "martial",
    howToCalculate: "fix",
    damage: 240,
    element: "thunder",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 78,
  },
  {
    name: "でんせつのギガデイン",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 62,
    maxInt: 500,
    maxIntDamage: 188,
    skillPlus: 1.15,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 69,
    appliedEffect: { spellBarrier: { strength: -1, probability: 0.3 } },
  },
  {
    name: "いてつくマヒャド",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 200,
    maxInt: 400,
    maxIntDamage: 316,
    skillPlus: 1.15,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 92,
    ignoreReflection: true,
    followingSkill: "いてつくはどう",
  },
  {
    name: "おうじゃのけん",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.09,
    element: "light",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 59,
    ignoreReflection: true,
    ignoreProtection: true,
    RaceBane: ["???", "超魔王", "超伝説"],
    RaceBaneValue: 3,
  },
  {
    name: "閃光ジゴデイン",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 239,
    maxInt: 800,
    maxIntDamage: 435,
    skillPlus: 1.15,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 40,
  },
  {
    name: "ロトの剣技",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.06,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 38,
    ignoreEvasion: true,
    ignoreSubstitute: true,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "ひかりのたま",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    order: "preemptive",
    preemptiveGroup: 7,
    isOneTimeUse: true,
    ignoreReflection: true, //不要
    appliedEffect: "divineWave",
    followingSkill: "ひかりのたま回復封じ",
    discription1: "【戦闘中1回】【先制】敵全体の　状態変化を【反射無視】で",
    discription2: "解除（上位効果）し　回復封じ状態にする　その後",
    discription3: "味方全体のHPを全回復し　斬撃・呪文防御を1段階上げる",
  },
  {
    name: "ひかりのたま回復封じ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: { healBlock: {} },
    followingSkill: "ひかりのたま回復",
  },
  {
    name: "ひかりのたま回復",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 0,
    act: async function (skillUser, skillTarget) {
      applyHeal(skillTarget, skillTarget.defaultStatus.HP);
    },
    appliedEffect: { slashBarrier: { strength: 1 }, spellBarrier: { strength: 1 } },
  },
  {
    name: "真・魔神の絶技",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.21,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 60,
    ignoreEvasion: true,
    appliedEffect: { defUp: { strength: -1, probability: 0.66 } },
  },
  {
    name: "すさまじいオーラ",
    type: "martial",
    howToCalculate: "fix",
    damage: 195,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 82,
    damageByLevel: true,
    appliedEffect: "disruptiveWave",
    //体技以外の反射に3倍
    act: function (skillUser, skillTarget) {
      delete skillTarget.buffs.powerCharge;
      delete skillTarget.buffs.manaBoost;
      delete skillTarget.buffs.breathCharge;
    },
  },
  {
    name: "魔神の構え",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 5,
    MPcost: 52,
    isOneTimeUse: true,
    appliedEffect: {
      slashEvasion: { unDispellable: true, duration: 4 },
      spellEvasion: { unDispellable: true, duration: 4 },
      breathEvasion: { unDispellable: true, duration: 4 },
    },
    discription2: "4ターンの間　自分を斬撃・呪文・息無効状態にする",
  },
  {
    name: "魔手黒闇",
    type: "martial",
    howToCalculate: "atk",
    ratio: 2,
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 58,
    criticalHitProbability: 0,
    ignoreSubstitute: true,
    ignoreReflection: true,
    RaceBane: ["???"],
    RaceBaneValue: 3,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "ダークミナデイン",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 60,
    act: function (skillUser, skillTarget) {
      if (skillTarget.monsterId !== skillUser.monsterId) {
        applyDamage(skillTarget, 60, 1, true, false, false, false, null);
      }
    },
    followingSkill: "ダークミナデイン後半",
  },
  {
    name: "ダークミナデイン後半",
    type: "spell",
    howToCalculate: "fix",
    damage: 280,
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreProtection: true,
    lowHpDamageMultiplier: true,
    appliedEffect: { confused: { probability: 0.5313 } },
  },
  {
    name: "ミナデイン",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 50,
    act: function (skillUser, skillTarget) {
      if (skillTarget.monsterId !== skillUser.monsterId) {
        applyDamage(skillTarget, 50, 1, true, false, false, false, null);
      }
    },
    followingSkill: "ミナデイン後半",
  },
  {
    name: "ミナデイン後半",
    type: "spell",
    howToCalculate: "fix",
    damage: 338,
    element: "light",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreProtection: true,
  },
  {
    name: "無情な連撃",
    type: "martial",
    howToCalculate: "fix",
    damage: 140,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 15,
    MPcost: 62,
    appliedEffect: { paralyzed: { probability: 0.08 }, fear: { probability: 0.1 } },
  },
  {
    name: "神獣の氷縛",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 48,
    isOneTimeUse: true,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    appliedEffect: { stoned: { probability: 1, duration: 2, isGolden: true, element: "ice" } },
  },

  {
    name: "光芒の絶技",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.21,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 60,
    appliedEffect: { defUp: { strength: -1, probability: 0.5 } },
  },
  {
    name: "轟雷滅殺剣",
    type: "slash",
    howToCalculate: "atk",
    ratio: 4.6,
    element: "io",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 75,
    ignoreEvasion: true,
    followingSkill: "轟雷滅殺剣後半",
  },
  {
    name: "天雷の舞い",
    type: "dance",
    howToCalculate: "fix",
    damage: 163,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 41,
    appliedEffect: { healBlock: {} },
  },
  {
    name: "テンペストエッジ",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.09,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 69,
    ignoreEvasion: true,
    appliedEffect: { slashBarrier: { strength: -1 } },
  },
  {
    name: "魔壊裂き",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "dark",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 65,
    order: "preemptive",
    preemptiveGroup: 8,
    RaceBane: ["???"],
    RaceBaneValue: 2,
    criticalHitProbability: 0,
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      for (const monster of parties[skillUser.teamID]) {
        applyBuff(monster, { makaiBoost: { strength: 0.2, duration: 3 } });
      }
    },
  },
  {
    name: "崩壊裂き",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 60,
    RaceBane: ["???"],
    RaceBaneValue: 2,
    criticalHitProbability: 0,
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      applyBuff(skillUser, { baiki: { strength: 1 }, spdUp: { strength: 1 } });
    },
  },
  {
    name: "闇竜の構え",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 5,
    MPcost: 32,
    appliedEffect: {
      slashReflection: { strength: 2.5, duration: 1, unDispellable: true, removeAtTurnStart: true, dispellableByAbnormality: true },
      martialReflection: { strength: 2.5, duration: 1, unDispellable: true, removeAtTurnStart: true, dispellableByAbnormality: true },
      protection: { strength: 0.5, duration: 1, removeAtTurnStart: true },
    },
  },
  {
    name: "闇の天地",
    type: "martial",
    howToCalculate: "fix",
    damage: 247,
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 82,
    ignoreProtection: true,
    damageByLevel: true,
    appliedEffect: { fear: { probability: 0.37 }, martialSeal: { probability: 0.38 } },
  },
  {
    name: "深淵の儀式",
    type: "ritual",
    howToCalculate: "fix",
    damage: 280,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 73,
    appliedEffect: { crimsonMist: { strength: 0.33 }, manaReduction: { strength: 0.5, duration: 2 } },
  },
  {
    name: "暴風の儀式",
    type: "ritual",
    howToCalculate: "fix",
    damage: 280,
    element: "wind",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 56,
    weakness18: true,
    appliedEffect: { paralyzed: { probability: 0.4 } },
  },
  {
    name: "禁忌の左腕",
    type: "slash",
    howToCalculate: "atk",
    ratio: 4.6,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 70,
    ignoreEvasion: true,
    ignoreTypeEvasion: true,
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      applyBuff(skillUser, { baiki: { strength: 1 }, spdUp: { strength: 1 } });
    },
  },
  {
    name: "防壁反転",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 99,
    order: "preemptive",
    preemptiveGroup: 7,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreTypeEvasion: true,
    act: async function (skillUser, skillTarget) {
      if (skillTarget.buffs.sacredBarrier) {
        delete skillTarget.buffs.sacredBarrier;
        applyBuff(skillTarget, { dotDamage: { strength: 0.2 } });
      }
    },
  },
  {
    name: "勇者の一撃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 4.6,
    element: "thunder",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 65,
    isOneTimeUse: true,
    ignoreProtection: true,
    ignoreEvasion: true,
    ignoreTypeEvasion: true,
  },
  {
    name: "竜王の息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 464,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 85,
    appliedEffect: { spdUp: { strength: -1, probability: 0.39 }, fear: { probability: 0.3133 } },
  },
  {
    name: "ベギラマの剣",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.21,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 72,
    criticalHitProbability: 0,
  },
  {
    name: "勇者のきらめき",
    type: "martial",
    howToCalculate: "fix",
    damage: 124,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 62,
    order: "anchor",
    anchorBonus: 4,
    damageByLevel: true,
  },
  {
    name: "王女の愛",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 150,
    isOneTimeUse: true,
    isHealSkill: true,
    act: async function (skillUser, skillTarget) {
      for (const monster of parties[skillUser.teamID]) {
        if (monster.flags.isDead && !monster.buffs.reviveBlock) {
          // 間隔skip 蘇生成功時に全回復表示
          if (await reviveMonster(monster, 1, false, true)) {
            displayDamage(monster, monster.defaultStatus.HP, -1);
          }
        } else {
          applyHeal(monster, monster.defaultStatus.HP, false, false);
        }
      }
      await sleep(400);
    },
  },
  {
    name: "精霊の愛",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcostRatio: 1,
    isOneTimeUse: true,
    isHealSkill: true,
    act: async function (skillUser, skillTarget) {
      for (const monster of parties[skillUser.teamID]) {
        if (monster.flags.isDead && !monster.buffs.reviveBlock) {
          // 間隔skip 蘇生成功時に全回復表示
          if (await reviveMonster(monster, 1, false, true)) {
            displayDamage(monster, monster.defaultStatus.HP, -1);
          }
        } else {
          applyHeal(monster, monster.defaultStatus.HP, false, false);
        }
        applyBuff(monster, { spdUp: { strength: 1 } });
      }
      await sleep(400);
    },
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      applyBuff(skillUser, { sealed: {} });
    },
  },
  {
    name: "閃光裂衝拳",
    type: "martial",
    howToCalculate: "atk",
    ratio: 2.15,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 98,
    RaceBane: ["???"],
    RaceBaneValue: 2,
    ignoreEvasion: true,
    followingSkill: "閃光裂衝拳後半",
  },
  {
    name: "閃光裂衝拳後半",
    type: "martial",
    howToCalculate: "fix",
    damage: 260,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: { martialBarrier: { strength: -1, probability: 0.45 } },
  },
  {
    name: "ホワイトアウト",
    type: "breath",
    howToCalculate: "fix",
    damage: 464,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 85,
    appliedEffect: { asleep: { probability: 0.5 } },
  },
  {
    name: "マヒャドブロウ",
    type: "martial",
    howToCalculate: "atk",
    ratio: 0.82,
    element: "ice",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 45,
  },
  {
    name: "ひしょうきゃく",
    type: "martial",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 45,
    order: "preemptive",
    preemptiveGroup: 8,
    ignoreEvasion: true,
  },
  {
    name: "鉄拳の構え",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 5,
    isOneTimeUse: true,
    MPcost: 46,
    appliedEffect: { powerCharge: { strength: 2, duration: 2, keepOnDeath: true }, alwaysCrit: { keepOnDeath: true, removeAtTurnStart: true, duration: 2 } },
  },
  {
    name: "究極呪文マダンテ",
    type: "spell",
    howToCalculate: "MP",
    MPDamageRatio: 2.2,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcostRatio: 1,
    ignoreReflection: true,
  },
  {
    name: "圧縮マダンテ",
    type: "spell",
    howToCalculate: "MP",
    MPDamageRatio: 4.6,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcostRatio: 1,
    isOneTimeUse: true,
    ignoreReflection: true,
  },
  {
    name: "もえさかる業火",
    type: "breath",
    howToCalculate: "fix",
    damage: 230,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 60,
    appliedEffect: { baiki: { strength: -1, probability: 0.33 }, intUp: { strength: -1, probability: 0.33 } },
  },
  {
    name: "メラゾスペル",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 125,
    maxInt: 600,
    maxIntDamage: 250,
    skillPlus: 1.15,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 55,
    ignoreProtection: true,
  },
  {
    name: "爆炎の流星",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 128,
    maxInt: 1000,
    maxIntDamage: 280,
    skillPlus: 1.09,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 88,
    appliedEffect: { spellBarrier: { strength: -1 } },
  },
  {
    name: "呪いのつえ",
    type: "martial",
    howToCalculate: "fix",
    damage: 460,
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 100,
    damageByLevel: true,
    appliedEffect: { confused: { probability: 0.604 }, statusLock: { probability: 0.6242 } },
  },
  {
    name: "苦悶の魔弾",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 126,
    maxInt: 600,
    maxIntDamage: 250,
    skillPlus: 1.15,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 0,
    ignoreReflection: true,
    afterActionAct: async function (skillUser) {
      await sleep(200);
      applyDamage(skillUser, 360, 1, false, false, false, false, null);
      await checkRecentlyKilledFlagForPoison(skillUser);
      // 全滅させた後にも自傷と蘇生を実行
    },
  },
  {
    name: "セクシービーム",
    type: "martial",
    howToCalculate: "fix",
    damage: 470,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 38,
    damageByLevel: true,
    appliedEffect: { MPabsorption: { strength: 50 }, tempted: { probability: 0.3571 } }, //todo: 反射時自分にMP吸収付与？
  },
  {
    name: "破邪のベギラゴン",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 220,
    maxInt: 600,
    maxIntDamage: 356,
    skillPlus: 1.15,
    element: "thunder",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 108,
    ignoreReflection: true,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "クロスレジェンド",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.5,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 67,
    RaceBane: ["超伝説"],
    RaceBaneValue: 5,
    followingSkill: "クロスレジェンド後半",
  },
  {
    name: "クロスレジェンド後半",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.3,
    element: "io",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    RaceBane: ["超伝説"],
    RaceBaneValue: 5,
    ignoreReflection: true,
    ignoreEvasion: true,
  },
  {
    name: "灼熱剣舞",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.89,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 58,
    appliedEffect: { spdUp: { strength: -1, probability: 0.25 } },
  },
  {
    name: "ゴールドフェザー",
    type: "martial",
    howToCalculate: "fix",
    damage: 410,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 108,
    damageByLevel: true,
    appliedEffect: { breathBarrier: { strength: -2, probability: 0.43 }, fear: { probability: 0.3233 } },
  },
  {
    name: "無刀陣",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 5, // みがわり後
    MPcost: 34,
    isOneTimeUse: true,
    appliedEffect: {
      isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" },
      counterAttack: { divineDispellable: true, removeAtTurnStart: true, duration: 1 }, //死亡時解除
      aiExtraAttacks: { keepOnDeath: true, strength: 1 },
    },
    act: function (skillUser, skillTarget) {
      skillUser.abilities.additionalCounterAbilities = [
        {
          name: "無刀陣反撃状態",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の 反撃！`);
          },
          unavailableIf: (skillUser) => !skillUser.buffs.counterAttack,
          act: async function (skillUser, counterTarget) {
            await executeSkill(skillUser, findSkillByName("アバンストラッシュ反撃"), counterTarget);
          },
        },
      ];
    },
  },
  {
    name: "火竜変化呪文先制",
    displayName: "火竜変化呪文",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 7, //仮に全体
    MPcostRatio: 1,
    isOneTimeUse: true,
    act: async function (skillUser, skillTarget) {
      delete skillUser.buffs.abanPreemptive;
      displayMessage("＊「いきますよ…！", "  ド・ラ・ゴ・ラ・ム！！");
      executeRadiantWave(skillUser, true);
      skillUser.flags.abanTransformed = true;
      skillUser.buffs.fireBreak = { keepOnDeath: true, strength: 3 };
      applyBuff(skillUser, { metal: { keepOnDeath: true, strength: 0.33 }, prismVeil: { strength: 2, duration: 2 } });
      skillUser.skill[0] = "メラゾブレス";
      skillUser.skill[1] = "暴れまわる";
      skillUser.iconSrc = "images/icons/" + skillUser.id + "DragonTransformed.jpeg";
      updateBattleIcons(skillUser);
      await sleep(150);
      applyHeal(skillUser, skillUser.defaultStatus.HP);
      await sleep(250);
    },
  },
  {
    name: "火竜変化呪文",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcostRatio: 1,
    isOneTimeUse: true,
    act: async function (skillUser, skillTarget) {
      displayMessage("＊「いきますよ…！", "  ド・ラ・ゴ・ラ・ム！！");
      executeRadiantWave(skillUser, true);
      skillUser.flags.abanTransformed = true;
      skillUser.buffs.fireBreak = { keepOnDeath: true, strength: 3 };
      applyBuff(skillUser, { metal: { keepOnDeath: true, strength: 0.33 }, prismVeil: { strength: 2, duration: 2 } });
      skillUser.skill[0] = "メラゾブレス";
      skillUser.skill[1] = "暴れまわる";
      skillUser.iconSrc = "images/icons/" + skillUser.id + "DragonTransformed.jpeg";
      updateBattleIcons(skillUser);
      await sleep(150);
      applyHeal(skillUser, skillUser.defaultStatus.HP);
      await sleep(250);
    },
  },
  {
    name: "メラゾブレス",
    type: "breath",
    howToCalculate: "fix",
    damage: 280,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 0,
    ignoreReflection: true,
    ignoreProtection: true,
  },
  {
    name: "暴れまわる",
    type: "martial",
    howToCalculate: "fix",
    damage: 380,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 0,

    ignoreProtection: true,
  },
  {
    name: "邪悪なともしび",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 95,
    maxInt: 1000,
    maxIntDamage: 230,
    skillPlus: 1.15,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 57,
    appliedEffect: { powerWeaken: { strength: 0.5, duration: 2 } },
    selfAppliedEffect: async function (skillUser) {
      const newStrength = Math.min(3, skillUser.buffs.tyoryuLevel.strength + 1);
      skillUser.buffs.tyoryuLevel.strength = newStrength;
      updateMonsterBuffsDisplay(skillUser);
    },
  },
  {
    name: "正体をあらわす",
    type: "ritual",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 1,
    MPcost: 0,
    isOneTimeUse: true,
    act: async function (skillUser, skillTarget) {
      await transformTyoma(skillUser);
    },
  },
  {
    name: "蘇生封じの術",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 52,
    appliedEffect: { reviveBlock: { duration: 1, zombieBuffable: true } },
    followingSkill: "蘇生封じの術後半",
    discription2: "敵1体を　1ラウンドの間　蘇生封じ状態にし",
    discription3: "その後　敵全体に　軽減無視で　無属性の呪文攻撃",
  },
  {
    name: "蘇生封じの術後半",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 180,
    maxInt: 600,
    maxIntDamage: 410,
    skillPlus: 1.15,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreProtection: true,
  },
  {
    name: "覇者の怒り",
    type: "martial",
    howToCalculate: "fix",
    damage: 477,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 71,
    ignoreReflection: true,
    appliedEffect: { fear: { probability: 0.6651 } },
  },
  {
    name: "竜牙",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 53,
    ignoreEvasion: true,
    criticalHitProbability: 0,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "王の竜牙",
    type: "slash",
    howToCalculate: "atk",
    ratio: 4,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 53,
    ignoreSubstitute: true,
    ignoreEvasion: true,
    criticalHitProbability: 0,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "覇者の竜牙",
    type: "slash",
    howToCalculate: "atk",
    ratio: 4,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 53,
    ignoreSubstitute: true,
    ignoreEvasion: true,
    criticalHitProbability: 1,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
    discription2: "敵1体に　攻撃力依存で　無属性の斬撃攻撃",
    discription3: "この攻撃は必ず会心の一撃になる　命中時　くじけぬ心解除", //spaceなし
  },
  {
    name: "竜の炎",
    type: "breath",
    howToCalculate: "fix",
    damage: 260,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 79,
    ignoreReflection: true,
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      for (const monster of parties[skillUser.enemyTeamID]) {
        applyBuff(monster, { dotDamage: { strength: 0.2 } });
      }
    },
    discription1: "【反射無視】ランダムに6回　メラ系の息攻撃",
    discription2: "その後　敵全体を　継続ダメージ状態にする",
  },
  {
    name: "破滅の炎",
    type: "breath",
    howToCalculate: "fix",
    damage: 260,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 7,
    MPcost: 79,
    ignoreReflection: true,
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      for (const monster of parties[skillUser.enemyTeamID]) {
        applyBuff(monster, { dotDamage: { strength: 0.2 } });
      }
    },
    discription1: "【反射無視】ランダムに7回　メラ系の息攻撃",
    discription2: "その後　敵全体を　継続ダメージ状態にする",
  },
  {
    name: "終焉の炎",
    type: "breath",
    howToCalculate: "fix",
    damage: 260,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 9,
    MPcost: 79,
    ignoreReflection: true,
    ignoreProtection: true,
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      for (const monster of parties[skillUser.enemyTeamID]) {
        applyBuff(monster, { dotDamage: { strength: 0.2 } });
      }
    },
    discription2: "ランダムに9回　メラ系の息攻撃",
    discription3: "その後　敵全体を　継続ダメージ状態にする",
  },
  {
    name: "裂空の一撃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 6.9,
    element: "wind",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 65,
    ignoreEvasion: true,
    ignoreProtection: true,
    ignoreTypeEvasion: true,
  },
  {
    name: "葬送の剣技",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.15,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 55,
    appliedEffect: { reviveBlock: { duration: 1 } },
  },
  {
    name: "いてつく乱舞",
    type: "martial",
    howToCalculate: "atk",
    ratio: 1.1,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 51,
    ignoreEvasion: true,
    ignoreSubstitute: true,
    appliedEffect: "divineWave",
  },
  {
    name: "ソウルブレイカー",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.1,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 58,
    substituteBreaker: 3,
    absorptionRatio: 0.5,
  },
  {
    name: "剣聖刃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.85,
    element: "wind",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 53,
    ignoreEvasion: true,
    ignoreTypeEvasion: true,
    appliedEffect: { fear: { probability: 0.27 } },
  },
  {
    name: "貴公子の円舞",
    type: "dance",
    howToCalculate: "fix",
    damage: 280,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 55,
    appliedEffect: { dotDamage: { strength: 0.2 }, healBlock: {} },
  },
  {
    name: "憤怒の雷",
    type: "martial",
    howToCalculate: "fix",
    damage: 850,
    element: "thunder",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 58,
    weakness18: true,
  },
  {
    name: "ねだやしの業火",
    type: "breath",
    howToCalculate: "fix",
    damage: 280,
    element: "thunder",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 145,
    ignoreSubstitute: true,
    appliedEffect: { dotMPdamage: { strength: 100 } },
  },
  {
    name: "真・カラミティウォール",
    type: "martial",
    howToCalculate: "fix",
    damage: 430,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 105,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    damageByLevel: true,
    appliedEffect: { healBlock: { keepOnDeath: true, unDispellableByRadiantWave: true }, kiganLevel: { keepOnDeath: true, strength: 1 } },
  },
  {
    name: "イオラの嵐",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 128,
    maxInt: 1000,
    maxIntDamage: 280,
    skillPlus: 1.075,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 60,
    ignoreReflection: true,
    appliedEffect: { kiganLevel: { keepOnDeath: true, strength: 1, maxStrength: 2, probability: 0.75 } }, //推測確率
  },
  {
    name: "真・カイザーフェニックス",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 270,
    maxInt: 1000,
    maxIntDamage: 370,
    skillPlus: 1.15,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 50,
    ignoreProtection: true,
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.kiganLevel) {
        return 2;
      }
    },
  },
  {
    name: "真・カイザーフェニックス反撃用みがわり無視",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 180,
    maxInt: 1000,
    maxIntDamage: 290,
    skillPlus: 1.15,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 50,
    ignoreProtection: true,
    ignoreSubstitute: true,
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.kiganLevel) {
        return 2;
      }
    },
  },
  {
    name: "真・カラミティエンド",
    type: "slash",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 48,
    ignoreReflection: true,
    ignoreEvasion: true,
    ignoreSubstitute: true,
    ignoreDazzle: true,
    appliedEffect: { kiganLevel: { keepOnDeath: true, strength: 2 } },
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
    followingSkill: "真・カラミティエンド後半",
  },
  {
    name: "真・カラミティエンド後半",
    type: "slash",
    howToCalculate: "fix",
    damage: 550,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreReflection: true,
    ignoreEvasion: true,
    ignoreSubstitute: true,
    ignoreDazzle: true,
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.healBlock) {
        return 2;
      }
    },
  },
  {
    name: "極・天地魔闘の構え",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 5,
    isOneTimeUse: true,
    MPcost: 82,
    appliedEffect: { damageLimit: { unDispellable: true, strength: 75, duration: 1 }, counterAttack: { keepOnDeath: true, unDispellable: true, removeAtTurnStart: true, duration: 1 } },
    act: function (skillUser, skillTarget) {
      skillUser.abilities.additionalCounterAbilities = [
        {
          name: "極・天地魔闘の構え反撃状態",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}は`, `真・カラミティエンドを はなった！`);
          },
          unavailableIf: (skillUser) => !skillUser.buffs.counterAttack,
          act: async function (skillUser, counterTarget) {
            delete skillUser.buffs.counterAttack;
            await executeSkill(skillUser, findSkillByName("真・カラミティエンド"), counterTarget);
            await sleep(200);
            await executeSkill(skillUser, findSkillByName("真・カイザーフェニックス反撃用みがわり無視"), counterTarget);
          },
        },
      ];
    },
  },
  {
    name: "うちくだく",
    type: "martial",
    howToCalculate: "fix",
    damage: 380,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 0,
    ignoreProtection: true,
  },
  {
    name: "鬼眼砲",
    type: "martial",
    howToCalculate: "fix",
    damage: 750,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    order: "anchor",
    anchorBonus: 2,
    MPcost: 0,
    isOneTimeUse: true,
    ignoreReflection: true,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "第三の瞳",
    type: "martial",
    howToCalculate: "fix",
    damage: 90,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 60,
    damageByLevel: true,
    appliedEffect: "divineWave",
  },
  {
    name: "大魔王のメラ",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 490,
    maxInt: 800,
    maxIntDamage: 908,
    skillPlus: 1.15,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 3,
  },
  {
    name: "ホーリーナックル",
    type: "martial",
    howToCalculate: "atk",
    ratio: 2.18,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 55,
    order: "anchor",
    ignoreEvasion: true,
  },
  {
    name: "かばう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 9,
    order: "preemptive",
    preemptiveGroup: 4,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, skillTarget);
    },
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      applyBuff(skillUser, { slashBarrier: { strength: 1 } });
    },
    unavailableIf: (skillUser) => skillUser.flags.isSubstituting || skillUser.flags.hasSubstitute,
  },
  {
    name: "いてつくゆきだま",
    type: "martial",
    howToCalculate: "fix",
    damage: 184,
    element: "ice",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 7,
    MPcost: 54,
    appliedEffect: "disruptiveWave",
  },
  {
    name: "はんげきのゆきだま1発目",
    type: "martial",
    howToCalculate: "fix",
    damage: 184,
    element: "ice",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    isCounterSkill: true,
    skipAbnormalityCheck: true,
    ignoreSubstitute: true,
    appliedEffect: "disruptiveWave",
    followingSkill: "はんげきのゆきだま2発目",
  },
  {
    name: "はんげきのゆきだま2発目",
    type: "martial",
    howToCalculate: "fix",
    damage: 184,
    element: "ice",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    isCounterSkill: true,
    skipAbnormalityCheck: true,
    ignoreSubstitute: true,
    appliedEffect: "disruptiveWave",
  },
  {
    name: "ムフォムフォダンス",
    type: "dance",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 46,
    order: "preemptive",
    preemptiveGroup: 2,
    ignoreReflection: true,
    ignoreSubstitute: true,
    appliedEffect: { baiki: { strength: 2 }, defUp: { strength: -2 } },
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      for (const monster of parties[skillUser.teamID]) {
        applyBuff(monster, { baiki: { strength: 2 }, defUp: { strength: -2 } });
      }
    },
    discription2: "敵味方全体の　攻撃力を2段階上げ　防御力を2段階下げる",
  },
  {
    name: "神獣王の防壁",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 94,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { sacredBarrier: {}, slashBarrier: { strength: 1 }, spellBarrier: { strength: 1 } },
    act: async function (skillUser, skillTarget) {
      await executeRadiantWave(skillTarget, true, true); // マソも解除
    },
  },
  {
    name: "空中ふゆう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 49,
    order: "preemptive",
    preemptiveGroup: 3,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, null, true);
    },
    selfAppliedEffect: async function (skillUser) {
      for (const monster of parties[skillUser.teamID]) {
        applyBuff(monster, { dodgeBuff: { strength: 0.5 } });
      }
    },
    unavailableIf: (skillUser) => skillUser.flags.isSubstituting || skillUser.flags.hasSubstitute,
  },
  {
    name: "みかわしのひやく",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "dead",
    targetTeam: "ally",
    MPcost: 108,
    act: async function (skillUser, skillTarget) {
      await reviveMonster(skillTarget);
      applyBuff(skillTarget, { dodgeBuff: { decreaseBeforeAction: true, duration: 1, strength: 0.5 } });
    },
  },
  {
    name: "聖なる流星",
    type: "martial",
    howToCalculate: "def",
    ratio: 0.3,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 56,
    ignoreEvasion: true,
    criticalHitProbability: 0,
    RaceBane: ["???"],
    RaceBaneValue: 2,
  },
  {
    name: "創世の光陰", //todo: 仮に7回
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 60,
    maxInt: 500,
    maxIntDamage: 186,
    skillPlus: 1.15,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 7,
    MPcost: 58,
  },
  {
    name: "ルビスビーム",
    type: "spell",
    howToCalculate: "int",
    minInt: 300,
    minIntDamage: 380,
    maxInt: 800,
    maxIntDamage: 900,
    skillPlus: 1.15,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 65,
    ignoreProtection: true,
  },
  {
    name: "暗黒しょうへき",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 60,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { breathBarrier: { strength: 1 }, martialBarrier: { strength: 1, probability: 0.4 } },
  },
  {
    name: "グランドショット",
    type: "martial",
    howToCalculate: "def",
    ratio: 0.8,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 41,
    criticalHitProbability: 0,
    ignoreEvasion: true,
    ignoreDazzle: true,
    ignoreProtection: true,
    afterActionAct: async function (skillUser) {
      for (let i = 0; i < skillUser.skill.length; i++) {
        if (skillUser.skill[i] === "グランドショット") {
          skillUser.skill[i] = "暗黒しょうへき";
        }
      }
    },
  },
  {
    name: "真夏の誘惑",
    type: "martial",
    howToCalculate: "fix",
    damage: 250,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 65,
    damageByLevel: true,
    appliedEffect: { tempted: { probability: 0.38 } },
  },
  {
    name: "まどいの風",
    type: "martial",
    howToCalculate: "fix",
    damage: 253,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 83,
    damageByLevel: true,
    appliedEffect: { confused: { probability: 0.28 } },
  },
  {
    name: "マホカンタ",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 22,
    appliedEffect: { spellReflection: { strength: 1, duration: 4, decreaseTurnEnd: true } },
  },
  {
    name: "おいかぜ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 22,
    appliedEffect: { breathReflection: { strength: 1, duration: 4, decreaseTurnEnd: true } },
  },
  {
    name: "マホターン",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 42,
    appliedEffect: { spellReflection: { strength: 1, duration: 1, decreaseTurnEnd: true } },
  },
  {
    name: "ぎゃくふう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 42,
    appliedEffect: { breathReflection: { strength: 1, duration: 1, decreaseTurnEnd: true } },
  },
  {
    name: "スキルターン",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 42,
    appliedEffect: { martialReflection: { strength: 1.5, duration: 1, decreaseTurnEnd: true } },
  },
  {
    name: "ブレードターン",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 42,
    appliedEffect: { slashReflection: { strength: 1.5, duration: 1, decreaseTurnEnd: true } },
  },
  {
    name: "ミラーステップ",
    type: "dance",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 30,
    appliedEffect: { danceReflection: { strength: 1.5, duration: 2, decreaseTurnEnd: true } },
  },
  {
    name: "かがやく息",
    type: "breath",
    howToCalculate: "fix",
    damage: 295,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 124,
  },
  {
    name: "ルカナン",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 18,
    appliedEffect: { defUp: { strength: -1, probability: 0.2 } },
  },
  {
    name: "ヘルスピア",
    type: "martial",
    howToCalculate: "fix",
    damage: 332,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 56,
    damageByLevel: true,
    appliedEffect: { healBlock: { probability: 0.5 } },
    followingSkill: "ヘルスピア後半",
  },
  {
    name: "ヘルスピア後半",
    type: "martial",
    howToCalculate: "fix",
    damage: 117,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    damageByLevel: true,
    appliedEffect: { healBlock: { probability: 0.5 } },
  },
  {
    name: "ザオリク",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "dead",
    targetTeam: "ally",
    MPcost: 103,
    act: async function (skillUser, skillTarget) {
      await reviveMonster(skillTarget);
    },
  },
  {
    name: "ザオラル",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "dead",
    targetTeam: "ally",
    MPcost: 34,
    act: async function (skillUser, skillTarget) {
      if (Math.random() < 0.7333) {
        await reviveMonster(skillTarget, 0.5);
      } else {
        displayMiss(skillTarget);
      }
    },
  },
  {
    name: "零時の儀式",
    type: "ritual",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 150,
    maxInt: 600,
    maxIntDamage: 330,
    skillPlus: 1.09,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    order: "preemptive",
    preemptiveGroup: 7,
    MPcost: 120,
    followingSkill: "零時の儀式後半",
  },
  {
    name: "零時の儀式後半",
    type: "ritual",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 0,
    appliedEffect: { spellBarrier: { strength: 1 } },
  },
  {
    name: "タイムストーム",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 130,
    maxInt: 1000,
    maxIntDamage: 218,
    skillPlus: 1.09,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 85,
    ignoreReflection: true,
    appliedEffect: { fear: { probability: 0.38 } },
  },
  {
    name: "クロノストーム",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 140,
    maxInt: 1000,
    maxIntDamage: 244,
    skillPlus: 1,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 85,
    order: "preemptive",
    preemptiveGroup: 8,
    ignoreReflection: true,
    appliedEffect: { sealed: { probability: 0.1912 } },
  },
  {
    name: "エレメントエラー",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 1,
    MPcost: 39,
    act: async function (skillUser, skillTarget) {
      if (!fieldState.psychoField) {
        fieldState.isDistorted = true;
        await deleteElementalBuffs();
        adjustFieldStateDisplay();
      }
    },
  },
  {
    name: "かくせいリバース",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 60,
    order: "anchor",
    isOneTimeUse: true,
    act: function (skillUser, skillTarget) {
      if (!fieldState.psychoField && !fieldState.disableReverse) {
        fieldState.isReverse = true;
        fieldState.isPermanentReverse = true;
        adjustFieldStateDisplay();
      }
      applyBuff(skillUser, { powerCharge: { strength: 1.5 }, manaBoost: { strength: 1.5 } });
    },
  },
  {
    name: "永劫の闇冥",
    type: "martial",
    howToCalculate: "fix",
    damage: 310,
    element: "dark",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 75,
    weakness18: true,
    appliedEffect: { healBlock: {} },
  },
  {
    name: "呪いの儀式",
    type: "ritual",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 150,
    maxInt: 600,
    maxIntDamage: 330,
    skillPlus: 1.09,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 90,
    appliedEffect: { statusLock: { probability: 0.7 } },
    discription2: "敵全体に　呪文計算で　無属性の儀式攻撃",
    discription3: "命中時　確率で状態変化を封じる",
  },
  {
    name: "はめつの流星",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 95,
    maxInt: 1000,
    maxIntDamage: 230,
    skillPlus: 1.15,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 88,
    ignoreSubstitute: true,
    damageByHpPercent: true,
  },
  {
    name: "暗黒神の連撃",
    type: "martial",
    howToCalculate: "fix",
    damage: 324,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 80,
    order: "anchor",
    anchorBonus: 3,
    ignoreSubstitute: true,
    damageByLevel: true,
  },
  {
    name: "真・神々の怒り",
    type: "martial",
    howToCalculate: "fix",
    damage: 676,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 65,
    RaceBane: ["???"],
    RaceBaneValue: 0.333,
    ignoreReflection: true,
    damageByLevel: true,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "爆炎の儀式",
    type: "ritual",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 180,
    maxInt: 600,
    maxIntDamage: 285,
    skillPlus: 1,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 65,
    weakness18: true,
  },
  {
    name: "真・闇の結界",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 5,
    MPcost: 38,
    appliedEffect: {
      slashReflection: { strength: 1, duration: 1, unDispellable: true, removeAtTurnStart: true, isKanta: true, dispellableByAbnormality: true },
      martialReflection: { strength: 1, duration: 1, unDispellable: true, removeAtTurnStart: true, dispellableByAbnormality: true },
    },
  },
  {
    name: "もえさかるほむら",
    type: "breath",
    howToCalculate: "fix",
    damage: 465,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 85,
    ignoreSubstitute: true,
    appliedEffect: { healBlock: {} },
  },
  {
    name: "無比なる覇気",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    order: "preemptive",
    preemptiveGroup: 7,
    MPcost: 56,
    appliedEffect: "disruptiveWave",
    selfAppliedEffect: async function (skillUser) {
      applyBuff(skillUser, { damageLimit: { keepOnDeath: true, strength: 300 } }, null, false, true);
    },
  },
  {
    name: "破鏡の円舞",
    type: "dance",
    howToCalculate: "fix",
    damage: 270,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 51,
  },
  {
    name: "魔空の一撃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 4.6,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 65,
    ignoreEvasion: true,
    ignoreProtection: true,
  },
  {
    name: "リーサルエッジ",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.8,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    order: "anchor",
    MPcost: 79,
    ignoreBaiki: true,
    ignorePowerCharge: true,
    criticalHitProbability: 1,
  },
  {
    name: "火艶乱拳",
    type: "martial",
    howToCalculate: "atk",
    ratio: 1,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 65,
    appliedEffect: { spdUp: { strength: -1, probability: 0.4 } },
  },
  {
    name: "溶熱の儀式",
    type: "ritual",
    howToCalculate: "fix",
    damage: 465,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 65,
    appliedEffect: "divineWave",
  },
  {
    name: "必殺の双撃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 4.6,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 100,
    ignoreSubstitute: true,
    ignoreEvasion: true,
    ignoreTypeEvasion: true,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
    followingSkill: "必殺の双撃後半",
  },
  {
    name: "必殺の双撃後半",
    type: "slash",
    howToCalculate: "atk",
    ratio: 4.6,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreSubstitute: true,
    ignoreEvasion: true,
    ignoreTypeEvasion: true,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "帝王のかまえ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 5,
    MPcost: 37,
    appliedEffect: {
      powerCharge: { strength: 2, duration: 3 },
      slashReflection: { strength: 1, duration: 2, unDispellable: true, removeAtTurnStart: true, isKanta: true },
      spellReflection: { strength: 1, duration: 2, unDispellable: true, removeAtTurnStart: true },
      damageLimit: { unDispellable: true, strength: 200, duration: 2 },
    },
  },
  {
    name: "体砕きの斬舞",
    type: "dance",
    howToCalculate: "atk",
    ratio: 0.44,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 41,
    criticalHitProbability: 0,
    //反射特攻はcalc内で
  },
  {
    name: "ミラクルムーン",
    type: "martial",
    howToCalculate: "atk",
    ratio: 0.5,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 41,
    absorptionRatio: 0.5,
  },
  {
    name: "翠嵐の息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 230,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 48,
    ignoreReflection: true,
    appliedEffect: { paralyzed: { probability: 0.56 } },
  },
  {
    name: "竜の波濤",
    type: "martial",
    howToCalculate: "fix",
    damage: 355,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 84,
    damageByLevel: true,
    appliedEffect: { crimsonMist: { strength: 0.33 } },
  },
  {
    name: "冥闇の息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 305,
    element: "dark",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 76,
    ignoreProtection: true,
    appliedEffect: { reviveBlock: { duration: 1 }, dazzle: {} },
  },
  {
    name: "業炎の息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 456,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 120,
  },
  {
    name: "虚空神の福音",
    type: "martial",
    howToCalculate: "fix",
    damage: 180,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 65,
    order: "preemptive",
    preemptiveGroup: 7,
    damageByLevel: true,
    appliedEffect: { fear: { probability: 0.3133 }, spdUp: { strength: -1, probability: 0.7822 } },
  },
  {
    name: "クラックストーム",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 130,
    maxInt: 1000,
    maxIntDamage: 220,
    skillPlus: 1.09,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 85,
    appliedEffect: { confused: { probability: 0.55 }, countDown: { count: 2, probability: 0.48 } },
  },
  {
    name: "属性断罪の刻印",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 64,
    order: "preemptive",
    preemptiveGroup: 7,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreTypeEvasion: true,
    appliedEffect: { elementalRetributionMark: {} },
  },
  {
    name: "サイコストーム",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 130,
    maxInt: 1000,
    maxIntDamage: 280,
    skillPlus: 1.075,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 80,
  },
  {
    name: "絶対零度",
    type: "breath",
    howToCalculate: "fix",
    damage: 364,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 136,
    appliedEffect: { fear: { probability: 0.213 } },
  },
  {
    name: "くいちぎる",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.35,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 36,
    ignoreEvasion: true,
    appliedEffect: { baiki: { strength: -2, probability: 0.23 }, defUp: { strength: -2, probability: 0.1 } },
  },
  {
    name: "咆哮",
    type: "martial",
    howToCalculate: "fix",
    damage: 400,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 98,
    additionalVersion: "追加用咆哮",
  },
  {
    name: "追加用咆哮",
    type: "martial",
    howToCalculate: "fix",
    damage: 340,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 98,
  },
  {
    name: "地殻変動",
    type: "martial",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 41,
    ignoreEvasion: true,
    ignoreDazzle: true,
  },
  {
    name: "大地の守り",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 36, //+0
    appliedEffect: { spellBarrier: { strength: 1 }, breathBarrier: { strength: 1 } },
  },
  {
    name: "アストロン",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 74,
    order: "preemptive",
    preemptiveGroup: 2,
    isOneTimeUse: true,
    appliedEffect: { stoned: { duration: 1 } },
  },
  {
    name: "アストロンゼロ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 52,
    order: "preemptive",
    preemptiveGroup: 5,
    isOneTimeUse: true,
    appliedEffect: { stoned: { duration: 1 } },
    act: function (skillUser, skillTarget) {
      skillUser.abilities.attackAbilities.nextTurnAbilities.push({
        act: async function (skillUser) {
          displayMessage(`${skillUser.name}は 全身から`, `いてつくはどうを はなった！`);
          await sleep(100);
          await executeSkill(skillUser, findSkillByName("いてつくはどう"));
        },
      });
    },
  },
  {
    name: "衝撃波",
    type: "martial",
    howToCalculate: "atk",
    ratio: 0.41,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 38,
    order: "anchor",
    anchorBonus: 3,
    ignoreEvasion: true,
    appliedEffect: { fear: { probability: 0.3287 } },
  },
  {
    name: "おおいかくす",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 16,
    order: "preemptive",
    preemptiveGroup: 4,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, skillTarget, false, true);
    },
    unavailableIf: (skillUser) => skillUser.flags.isSubstituting || skillUser.flags.hasSubstitute,
  },
  {
    name: "闇の紋章",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 53,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { darkResistance: { strength: 2 } },
    selfAppliedEffect: async function (skillUser) {
      for (const monster of parties[skillUser.enemyTeamID]) {
        applyBuff(monster, { darkResistance: { strength: 2 } });
      }
    },
    isOneTimeUse: true,
    discription1: "【戦闘中1回】【先制】【みがわり無視】【反射無視】",
    discription2: "敵味方全体の　ドルマ耐性を2ランク上げる",
    discription3: "体技無効状態を貫通する",
  },
  {
    name: "氷の紋章",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 53,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { iceResistance: { strength: 2 } },
    selfAppliedEffect: async function (skillUser) {
      for (const monster of parties[skillUser.enemyTeamID]) {
        applyBuff(monster, { iceResistance: { strength: 2 } });
      }
    },
    isOneTimeUse: true,
    discription1: "【戦闘中1回】【先制】【みがわり無視】【反射無視】",
    discription2: "敵味方全体の　ヒャド耐性を2ランク上げる",
    discription3: "体技無効状態を貫通する",
  },
  {
    name: "封印の光",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 23,
    appliedEffect: { statusLock: {} },
  },
  {
    name: "いてつくはどう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 42,
    appliedEffect: "disruptiveWave",
  },
  {
    name: "神のはどう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 42,
    appliedEffect: "divineWave",
  },
  {
    name: "女神のはばたき",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 49,
    appliedEffect: "divineWave",
  },
  {
    name: "真・いてつくはどう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 36,
    appliedEffect: "divineWave",
  },
  {
    name: "轟雷滅殺剣後半",
    type: "slash",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: "divineWave",
  },
  {
    name: "プチ神のはどう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 56,
    appliedEffect: "divineWave",
  },
  {
    name: "竜の眼光",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 50,
    appliedEffect: "divineWave",
  },
  {
    name: "光のはどう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 50,
    act: async function (skillUser, skillTarget) {
      await executeRadiantWave(skillTarget, false, true); // マソも解除
    },
  },
  {
    name: "極彩鳥のはどう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 58,
    appliedEffect: "disruptiveWave",
    followingSkill: "光のはどう",
  },
  {
    name: "教祖のはどう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 58,
    appliedEffect: "divineWave",
    ignoreSubstitute: true,
    act: async function (skillUser, skillTarget) {
      if (skillTarget.buffs.damageLimit && !skillTarget.buffs.damageLimit.keepOnDeath) {
        delete skillTarget.buffs.damageLimit;
      }
    },
    discription2: "敵全体の　状態変化解除（上位効果）・被ダメージ上限値解除",
  },
  {
    name: "邪悪なこだま",
    type: "martial",
    howToCalculate: "int",
    ratio: 1.09,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    MPcost: 63,
    hitNum: 5,
    ignoreProtection: true,
    ignoreEvasion: true,
    ignoreDazzle: true,
  },
  {
    name: "絶氷の嵐",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 245,
    maxInt: 800,
    maxIntDamage: 434,
    skillPlus: 1.15,
    element: "ice",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 68,
    hitNum: 3,
    ignoreReflection: true,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "神速メラガイアー",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 245,
    maxInt: 800,
    maxIntDamage: 434,
    skillPlus: 1.15,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 40,
    hitNum: 3,
  },
  {
    name: "禁忌のかくせい",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 74,
    order: "preemptive",
    preemptiveGroup: 1,
    act: function (skillUser, skillTarget) {
      if (skillTarget.race.includes("悪魔") && skillUser.monsterId !== skillTarget.monsterId) {
        applyBuff(skillTarget, { powerCharge: { strength: 1.5 }, manaBoost: { strength: 1.5 }, dotDamage: { strength: 0.33 } });
      }
    },
  },
  {
    name: "邪道のかくせい",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 86,
    order: "preemptive",
    preemptiveGroup: 1,
    isOneTimeUse: true,
    act: function (skillUser, skillTarget) {
      if (hasEnoughMonstersOfType(parties[skillUser.teamID], "悪魔", 5)) {
        for (const monster of parties[skillUser.teamID]) {
          if (monster.race.includes("悪魔")) {
            monster.abilities.supportAbilities.nextTurnAbilities.push({
              act: function (skillUser) {
                applyBuff(skillUser, { powerCharge: { strength: 3 }, manaBoost: { strength: 3 }, anchorAction: {} });
              },
            });
          }
        }
      }
    },
  },
  {
    name: "無双のつるぎ",
    type: "slash",
    howToCalculate: "fix",
    damage: 1300,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 78,
    ignoreEvasion: true, // マヌーサ有効
    followingSkill: "無双のつるぎ後半",
  },
  {
    name: "無双のつるぎ後半",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreEvasion: true,
    ignoreReflection: true,
  },
  {
    name: "瞬撃",
    type: "martial",
    howToCalculate: "atk",
    ratio: 1.08,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 68,
    ignoreReflection: true,
    ignoreEvasion: true,
    appliedEffect: "divineWave",
  },
  {
    name: "滅竜の絶技",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 58,
    RaceBane: ["ドラゴン"],
    RaceBaneValue: 2,
    appliedEffect: { defUp: { strength: -1, probability: 0.3 } },
  },
  {
    name: "誇りのつるぎ",
    type: "slash",
    howToCalculate: "fix",
    fixedDamage: true,
    damage: 1000,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 71,
    ignoreReflection: true, // みかわし マヌーサ有効
    followingSkill: "誇りのつるぎ後半",
  },
  {
    name: "誇りのつるぎ後半",
    type: "slash",
    howToCalculate: "fix",
    fixedDamage: true,
    damage: 145,
    element: "light",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreReflection: true, // みかわし マヌーサ有効
  },
  {
    name: "カタストロフ",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 162,
    maxInt: 1000,
    maxIntDamage: 290,
    skillPlus: 1.15,
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 92,
    appliedEffect: "divineWave",
  },
  {
    name: "らいてい弾",
    type: "martial",
    howToCalculate: "fix",
    damage: 270,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 44,
  },
  {
    name: "ラストストーム",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.2,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 91,
    order: "anchor",
    ignoreSubstitute: true,
    ignoreEvasion: true,
    appliedEffect: { statusLock: {}, paralyzed: { probability: 0.58 } },
  },
  {
    name: "イオナルーン",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 180,
    maxInt: 500,
    maxIntDamage: 360,
    skillPlus: 1.15,
    element: "io",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 47,
    RaceBane: ["???"],
    RaceBaneValue: 3,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "陰惨な暗闇",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 54,
    maxInt: 600,
    maxIntDamage: 164,
    skillPlus: 1.15,
    element: "dark",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 54,
    appliedEffect: { darkResistance: { strength: -1, probability: 0.57 } },
  },
  {
    name: "メゾラゴン",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 110,
    maxInt: 500,
    maxIntDamage: 300,
    skillPlus: 1.15,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 72,
    followingSkill: "メゾラゴン後半",
  },
  {
    name: "メゾラゴン後半",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 105,
    maxInt: 600,
    maxIntDamage: 240,
    skillPlus: 1.15,
    element: "thunder",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "メラゾロス",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 110,
    maxInt: 500,
    maxIntDamage: 300,
    skillPlus: 1.15,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 72,
    followingSkill: "メラゾロス後半",
  },
  {
    name: "メラゾロス後半",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 90,
    maxInt: 500,
    maxIntDamage: 200,
    skillPlus: 1.15,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "バギラ",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 44,
    maxInt: 600,
    maxIntDamage: 133,
    skillPlus: 1.15,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 46,
    followingSkill: "バギラ後半",
  },
  {
    name: "バギラ後半",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 54,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "thunder",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "ドルマズン",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 180,
    maxInt: 500,
    maxIntDamage: 360,
    skillPlus: 1.15,
    element: "dark",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 72,
    followingSkill: "ドルマズン後半",
  },
  {
    name: "ドルマズン後半",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 125,
    maxInt: 600,
    maxIntDamage: 250,
    skillPlus: 1.15,
    element: "io",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "イオナズン",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 125,
    maxInt: 600,
    maxIntDamage: 250,
    skillPlus: 1.15,
    element: "io",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 88,
  },
  {
    name: "ばくえんの秘術",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 125,
    maxInt: 600,
    maxIntDamage: 250,
    skillPlus: 1.15,
    element: "io",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 90,
    ignoreReflection: true,
  },
  {
    name: "絶望の爆炎",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 125,
    maxInt: 600,
    maxIntDamage: 250,
    skillPlus: 1.15,
    element: "io",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 90,
    ignoreReflection: true,
  },
  {
    name: "極大消滅呪文",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 125,
    maxInt: 600,
    maxIntDamage: 250,
    skillPlus: 1.15,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 88,
  },
  {
    name: "イオナスペル",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 220,
    maxInt: 1000,
    maxIntDamage: 300,
    skillPlus: 1.15,
    element: "io",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 167,
    appliedEffect: { confused: { probability: 0.53 } },
  },
  {
    name: "光速イオナスペル",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 90,
    maxInt: 600,
    maxIntDamage: 200,
    skillPlus: 1.15,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 48,
    ignoreReflection: true,
    appliedEffect: { confused: { probability: 0.35 } },
  },
  {
    name: "悪夢の雷鳴",
    type: "martial",
    howToCalculate: "int",
    ratio: 0.8,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    MPcost: 43,
    hitNum: 4,
    ignoreEvasion: true,
    ignoreDazzle: true,
  },
  {
    name: "ジゴデイン",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 260,
    maxInt: 900,
    maxIntDamage: 460,
    skillPlus: 1.15,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 46,
  },
  {
    name: "圧縮イオナズン",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 375,
    maxInt: 600,
    maxIntDamage: 750,
    skillPlus: 1.15,
    element: "io",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 48,
  },
  {
    name: "サイコキャノン",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 180,
    maxInt: 600,
    maxIntDamage: 410,
    skillPlus: 1.15,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 35,
  },
  {
    name: "蠱惑の舞い",
    type: "dance",
    howToCalculate: "fix",
    damage: 280,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 98,
    substituteBreaker: 3,
    appliedEffect: { confused: { probability: 0.377 } },
  },
  {
    name: "宵の暴風",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 120,
    maxInt: 1000,
    maxIntDamage: 144,
    skillPlus: 1.15,
    element: "wind",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 61,
    order: "preemptive",
    preemptiveGroup: 8,
    RaceBane: ["ドラゴン"],
    RaceBaneValue: 2,
    appliedEffect: { manaReduction: { strength: 0.5, duration: 2 } },
  },
  {
    name: "妖艶イオマータ",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 45,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "キャンセルステップ",
    type: "dance",
    howToCalculate: "fix",
    damage: 95,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 41,
    ignoreEvasion: true, // マヌーサ有効
    damageByLevel: true,
    appliedEffect: "disruptiveWave",
  },
  {
    name: "ディバインフェザー",
    type: "martial",
    howToCalculate: "fix",
    damage: 85,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 48,
    damageByLevel: true,
    appliedEffect: { spellBarrier: { strength: -2, probability: 0.33 } },
  },
  {
    name: "悪魔の息見切り",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 69,
    order: "preemptive",
    preemptiveGroup: 5,
    act: function (skillUser, skillTarget) {
      if (skillTarget.race.includes("悪魔")) {
        applyBuff(skillTarget, { breathEvasion: { duration: 1, removeAtTurnStart: true, divineDispellable: true } });
      } else {
        displayMiss(skillTarget);
      }
      applyBuff(skillUser, { breathEvasion: { duration: 1, removeAtTurnStart: true, divineDispellable: true } });
    },
  },
  {
    name: "竜の呪文見切り",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 69,
    order: "preemptive",
    preemptiveGroup: 5,
    act: function (skillUser, skillTarget) {
      if (skillTarget.race.includes("ドラゴン")) {
        applyBuff(skillTarget, { spellEvasion: { duration: 1, removeAtTurnStart: true, divineDispellable: true } });
      } else {
        displayMiss(skillTarget);
      }
      applyBuff(skillUser, { spellEvasion: { duration: 1, removeAtTurnStart: true, divineDispellable: true } });
    },
  },
  {
    name: "秘術イオマータ",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 90,
    maxInt: 600,
    maxIntDamage: 200,
    skillPlus: 1.15,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 48,
    ignoreReflection: true,
  },
  {
    name: "狂気のいあつ",
    type: "martial",
    howToCalculate: "fix",
    damage: 287,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 98,
    substituteBreaker: 3,
    damageByLevel: true,
    followingSkill: "狂気のいあつ魅了",
  },
  {
    name: "狂気のいあつ魅了",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: { tempted: { probability: 0.39 } },
    followingSkill: "狂気のいあつルカニ",
  },
  {
    name: "狂気のいあつルカニ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: { defUp: { strength: -1, probability: 0.4 } },
  },
  {
    name: "マインドバリア",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 27,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { mindBarrier: { duration: 4 } },
  },
  {
    name: "メダパニバリア",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 54,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { confusionBarrier: { duration: 4 }, mindBarrier: { duration: 4 } },
  },
  {
    name: "ふしぎなとばり",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 39,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { mindBarrier: { duration: 4 }, spellBarrier: { strength: 1, probability: 0.56 } },
  },
  {
    name: "あんこくのはばたき",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 56,
    appliedEffect: "disruptiveWave",
    followingSkill: "あんこくのはばたき後半",
  },
  {
    name: "あんこくのはばたき後半",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: { spellBarrier: { strength: -1, probability: 0.55 } },
  },
  {
    name: "催眠の邪弾",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 130,
    maxInt: 600,
    maxIntDamage: 162,
    skillPlus: 1.15,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 72,
    appliedEffect: { asleep: { probability: 0.53 } },
  },
  {
    name: "夢の世界",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 39,
    order: "preemptive",
    preemptiveGroup: 5,
    isOneTimeUse: true,
    appliedEffect: { protection: { strength: 0.9, duration: 2, removeAtTurnStart: true }, manaBoost: { strength: 2 }, asleepBreakBoost: { strength: 1, duration: 2, removeAtTurnStart: true } },
    //本来は2R行動後にブレイクは消失
  },
  {
    name: "ギラマータ",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 38,
  },
  {
    name: "閃光雷弾",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 55,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 48,
  },
  {
    name: "イオマータ",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 38,
  },
  {
    name: "バギマータ",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "wind",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 38,
  },
  {
    name: "幻術のひとみ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 48,
    order: "preemptive",
    preemptiveGroup: 8,
    appliedEffect: { asleep: { probability: 0.76 } },
  },
  {
    name: "だいぼうぎょ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 37,
    order: "preemptive",
    preemptiveGroup: 5,
    isOneTimeUse: true,
    appliedEffect: { protection: { strength: 0.9, duration: 2, removeAtTurnStart: true } },
  },
  {
    name: "精霊の守り・強",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 84,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { protection: { strength: 0.34, duration: 2, removeAtTurnStart: true } },
  },
  {
    name: "ミナカトール",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 84,
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { protection: { divineDispellable: true, strength: 0.34, duration: 1, removeAtTurnStart: true, iconSrc: "protectiondivineDispellablestr0.34" } },
  },
  {
    name: "巨岩投げ",
    type: "martial",
    howToCalculate: "fix",
    damage: 325,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 88,
    damageByHpPercent: true,
  },
  {
    name: "苛烈な暴風",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "wind",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 45,
    appliedEffect: { windResistance: { strength: -1, probability: 0.57 } },
  },
  {
    name: "冷酷な氷撃",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "ice",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 45,
    appliedEffect: { iceResistance: { strength: -1, probability: 0.57 } },
  },
  {
    name: "至高の閃光", //現状1.15で割った値を指定
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 54,
    maxInt: 600,
    maxIntDamage: 167,
    skillPlus: 1.15,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 52,
    appliedEffect: { lightResistance: { strength: -1, probability: 0.57 } },
  },
  {
    name: "魔の忠臣",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 14,
    order: "preemptive",
    preemptiveGroup: 3,
    act: function (skillUser, skillTarget) {
      if (hasEnoughMonstersOfType(parties[skillUser.teamID], "悪魔", 4)) {
        applySubstitute(skillUser, null, true);
      }
    },
    unavailableIf: (skillUser) => skillUser.flags.isSubstituting || skillUser.flags.hasSubstitute,
  },
  {
    name: "フローズンスペル",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "ice",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 54,
    appliedEffect: { fear: { element: "ice", probability: 0.7685 } },
  },
  {
    name: "氷の王国",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 53,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreTypeEvasion: true,
    appliedEffect: { sealed: { removeAtTurnStart: true, duration: 1, element: "ice", probability: 0.7533, zombieBuffable: true } },
    selfAppliedEffect: async function (skillUser) {
      for (const monster of parties[skillUser.teamID]) {
        // skillUserを渡して使い手反映
        applyBuff(monster, { sealed: { removeAtTurnStart: true, duration: 1, element: "ice", probability: 0.7533, zombieBuffable: true } }, skillUser);
      }
    },
    isOneTimeUse: true,
  },
  {
    name: "雪だるま",
    type: "martial",
    howToCalculate: "fix",
    damage: 180,
    element: "ice",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 51,
    isOneTimeUse: true,
    appliedEffect: { sealed: {} },
  },
  {
    name: "呪縛の氷撃",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 195,
    maxInt: 1000,
    maxIntDamage: 315,
    skillPlus: 1.15,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 121,
    appliedEffect: { fear: { probability: 0.22 } },
  },
  {
    name: "サイコバースト",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 215,
    maxInt: 600,
    maxIntDamage: 490,
    skillPlus: 1.15,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 45,
  },
  {
    name: "バギムーチョ",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 180,
    maxInt: 1000,
    maxIntDamage: 290,
    skillPlus: 1.15,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 102,
  },
  {
    name: "マインドブレス",
    type: "breath",
    howToCalculate: "fix",
    damage: 195,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 58,
    appliedEffect: { fear: { probability: 0.26 } },
  },
  {
    name: "ブギウギステップ",
    type: "dance",
    howToCalculate: "fix",
    damage: 207,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 75,
    appliedEffect: { fear: { probability: 0.25 } }, // 推測確率
  },
  {
    name: "たつまき",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 90,
    maxInt: 500,
    maxIntDamage: 201,
    skillPlus: 1.15,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 98,
    appliedEffect: { confused: { probability: 0.2 } }, // 推測確率
  },
  {
    name: "ひれつなさくせん",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 32,
    isOneTimeUse: true,
    ignoreReflection: true,
    ignoreSubstitute: true,
    order: "preemptive",
    preemptiveGroup: 8,
    act: async function (skillUser, skillTarget) {
      applyBuff(skillUser, { aiPursuitCommand: { unDispellable: true, removeAtTurnStart: true, duration: 2 } });
      // 次ターン最初のattackAbility時点まで所持していれば みがわり・行動停止を実行 石化 死亡 亡者化で解除 現状重ねがけによる毎ターン強制みがわりが可能
      applyBuff(skillTarget, { boogieCurse: { dispellableByRadiantWave: true, duration: 2, removeAtTurnStart: true, iconSrc: "willSubstitute" } });
      await sleep(130);
      // ひれつ・支配を既に予約している場合は重複付与しない
      if (skillTarget.abilities.attackAbilities.nextTurnAbilities.some((ability) => ability.name === "ひれつなさくせんみがわり実行" || ability.name === "しはいのさくせんみがわり実行")) return;
      displayMessage(`${skillTarget.name}は`, "次のラウンドで 敵の みがわりになる！");
      skillTarget.abilities.attackAbilities.nextTurnAbilities.push({
        name: "ひれつなさくせんみがわり実行",
        disableMessage: true,
        unavailableIf: (skillUser) => !skillUser.buffs.boogieCurse,
        act: async function (skillUser) {
          delete skillUser.buffs.boogieCurse;
          const aliveEnemies = parties[skillUser.enemyTeamID].filter((monster) => !monster.flags.isDead);
          // 状態異常でない場合のみみがわり実行
          if (!hasAbnormality(skillUser) && aliveEnemies.length > 0) {
            const randomTarget = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
            displayMessage(`${skillUser.name}は`, "敵の みがわりに なった！");
            await sleep(200);
            applySubstitute(skillUser, randomTarget, false, false, true); // isBoogie(光の波動解除フラグ)をtrueで送る
          } else {
            displayMiss(skillUser);
          }
          // みがわり実行の成否やみがわり先被りによる失敗にかかわらず行動停止を付与 hasAbnormalityに引っかからないようにみがわり判定後に付与
          applyBuff(skillUser, { boogieCurseSubstituting: { dispellableByRadiantWave: true, duration: 1, removeAtTurnStart: true } });
        },
      });
    },
  },
  {
    name: "しはいのさくせん",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 52,
    isOneTimeUse: true,
    ignoreReflection: true,
    ignoreSubstitute: true,
    order: "preemptive",
    preemptiveGroup: 8,
    act: async function (skillUser, skillTarget) {
      applyBuff(skillUser, { aiPursuitCommand: { unDispellable: true, removeAtTurnStart: true, duration: 2 } });
      await sleep(130);
      applyShihai(skillTarget);
    },
  },
  {
    name: "怨念ノ凶風",
    type: "breath",
    howToCalculate: "fix",
    damage: 230,
    element: "wind",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 65,
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      for (const monster of parties[skillUser.teamID]) {
        applyBuff(monster, { breathCharge: { strength: 1.5 } });
      }
    },
  },
  {
    name: "傀儡ノ調ベ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 40,
    appliedEffect: { spdUp: { strength: -1 } },
    followingSkill: "傀儡ノ調ベ後半",
  },
  {
    name: "傀儡ノ調ベ後半",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: { confused: { probability: 0.6333 } },
  },
  {
    name: "ヘブンリーブレス",
    type: "breath",
    howToCalculate: "fix",
    damage: 293,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 71,
    appliedEffect: { heavenlyBreath: { divineDispellable: true, duration: 3, probability: 0.42 } },
  },
  {
    name: "裁きの極光",
    type: "martial",
    howToCalculate: "fix",
    damage: 310,
    element: "light",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 112,
    damageByLevel: true,
    appliedEffect: { fear: { probability: 0.3663 } },
  },
  {
    name: "黄金の息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 230,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 62,
  },
  {
    name: "獣王の猛撃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.8,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 67,
    appliedEffect: "divineWave",
  },
  {
    name: "波状裂き",
    type: "slash",
    howToCalculate: "fix",
    damage: 60,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 150, // みかわし マヌーサ有効
  },
  {
    name: "ハリケーン",
    type: "martial",
    howToCalculate: "fix",
    damage: 310,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 100,
    damageByLevel: true,
  },
  {
    name: "ツイスター",
    type: "breath",
    howToCalculate: "fix",
    damage: 250,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 72,
    appliedEffect: "divineWave",
    reviseIf: function (skillUser) {
      if (!hasEnoughMonstersOfType(parties[skillUser.teamID], "魔獣", 3)) {
        return "ツイスター下位";
      }
    },
  },
  {
    name: "ツイスター下位",
    displayName: "ツイスター",
    type: "breath",
    howToCalculate: "fix",
    damage: 250,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 72,
    appliedEffect: "disruptiveWave",
  },
  {
    name: "浄化の風",
    type: "breath",
    howToCalculate: "fix",
    damage: 29, //144
    damageMultiplierBySameRace: true,
    element: "wind",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 57,
    RaceBane: ["???", "超魔王"],
    RaceBaneValue: 4,
    ignoreProtection: true,
    appliedEffect: { reviveBlock: { duration: 1 }, zombifyBlock: { removeAtTurnStart: true, duration: 1 } },
  },
  {
    name: "天翔の舞い",
    type: "dance",
    howToCalculate: "spd",
    ratio: 0.2,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 11,
    MPcost: 65,
  },
  {
    name: "狂乱のやつざき",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.09,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 48,
    appliedEffect: { asleep: { probability: 0.25 } }, //不明
  },
  {
    name: "火葬のツメ",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.5,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 55,
    ignoreBaiki: true,
    criticalHitProbability: 0.75,
  },
  {
    name: "暗黒の誘い",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 55,
    appliedEffect: { tempted: { probabilityMultiplierBySameRace: true, probability: 0.157 } }, //0.785
  },
  {
    name: "イブールの誘い",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 55,
    appliedEffect: { tempted: { probabilityMultiplierBySameRace: true, probability: 0.157 } }, //0.785
  },
  {
    name: "ビーストアイ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 36,
    order: "preemptive",
    preemptiveGroup: 7, //防御後
    isOneTimeUse: true,
    act: async function (skillUser, skillTarget) {
      if (hasEnoughMonstersOfType(parties[skillUser.teamID], "魔獣", 5)) {
        for (const monster of parties[skillUser.enemyTeamID]) {
          //全部削除
          delete monster.flags.isSubstituting;
          delete monster.flags.hasSubstitute;
          skillTarget.flags.thisTurn.substituteSeal = true;
          await updateMonsterBuffsDisplay(monster);
          displayMessage(`${monster.name}は`, "みがわりを ふうじられた！");
          await sleep(50);
        }
      }
    },
  },
  {
    name: "無慈悲なきりさき",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 48,
    ignoreEvasion: true,
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "超こうねつガス",
    type: "breath",
    howToCalculate: "fix",
    damage: 338,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 136,
    appliedEffect: { paralyzed: { probability: 0.3906 } },
  },
  {
    name: "昇天のこぶし",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 35,
    appliedEffect: { zombifyBlock: { removeAtTurnStart: true, duration: 1 } },
    act: function (skillUser, skillTarget) {
      ascension(skillTarget);
    },
    followingSkill: "昇天のこぶし後半",
  },
  {
    name: "昇天のこぶし後半",
    type: "martial",
    howToCalculate: "atk",
    ratio: 2.15,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "レインマダンテ",
    type: "spell",
    howToCalculate: "MP",
    MPDamageRatio: 1.62,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcostRatio: 1,
    ignoreReflection: true,
    ignoreSubstitute: true,
  },
  {
    name: "かえんりゅう",
    type: "martial",
    howToCalculate: "fix",
    damage: 300,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 106,
    damageByLevel: true,
    appliedEffect: { paralyzed: { probability: 0.5775 } },
  },
  {
    name: "天雷の息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 236,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 72,
    appliedEffect: { breathBarrier: { strength: -1 } },
  },
  {
    name: "抜刀魔獣刃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.3,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 45,
  },
  {
    name: "閃く短刀",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 108,
    ignoreBaiki: true,
    ignoreEvasion: true,
    criticalHitProbability: 1,
  },
  {
    name: "一刀両断",
    type: "slash",
    howToCalculate: "atk",
    ratio: 3.68,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 144,
    ignoreEvasion: true,
  },
  {
    name: "ラピッドショット",
    type: "martial",
    howToCalculate: "spd",
    ratio: 0.8,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 49,
    ignoreSubstitute: true,
  },
  {
    name: "聖なる息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 138,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 45,
    RaceBane: ["???"],
    RaceBaneValue: 2,
  },
  {
    name: "しっぷうづき",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.28,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 18,
    order: "preemptive",
    preemptiveGroup: 8,
  },
  {
    name: "なめまわし",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 18,
    appliedEffect: { tempted: { probability: 0.2 } },
  },
  {
    name: "クアトロマダンテ",
    type: "spell",
    howToCalculate: "MP",
    MPDamageRatio: 10.75,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcostRatio: 0.1,
    ignoreReflection: true,
    followingSkill: "クアトロマダンテ2発目",
  },
  {
    name: "クアトロマダンテ2発目",
    type: "spell",
    howToCalculate: "MP",
    MPDamageRatio: 10.75,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcostRatio: 0.1,
    ignoreReflection: true,
    followingSkill: "クアトロマダンテ3発目",
    afterActionAct: async function (skillUser) {
      const MPused = calculateMPcost(skillUser, findSkillByName("クアトロマダンテ"));
      skillUser.currentStatus.MP -= MPused;
      updateMonsterBar(skillUser);
    },
  },
  {
    name: "クアトロマダンテ3発目",
    type: "spell",
    howToCalculate: "MP",
    MPDamageRatio: 10.75,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcostRatio: 0.1,
    ignoreReflection: true,
    followingSkill: "クアトロマダンテ4発目",
    afterActionAct: async function (skillUser) {
      const MPused = calculateMPcost(skillUser, findSkillByName("クアトロマダンテ"));
      skillUser.currentStatus.MP -= MPused;
      updateMonsterBar(skillUser);
    },
  },
  {
    name: "クアトロマダンテ4発目",
    type: "spell",
    howToCalculate: "MP",
    MPDamageRatio: 10.75,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcostRatio: 0.1,
    ignoreReflection: true,
    afterActionAct: async function (skillUser) {
      const MPused = calculateMPcost(skillUser, findSkillByName("クアトロマダンテ"));
      skillUser.currentStatus.MP -= MPused;
      updateMonsterBar(skillUser);
    },
  },
  {
    name: "アイアンスラッシュ",
    type: "slash",
    howToCalculate: "def",
    ratio: 0.36, //1.8
    damageMultiplierBySameRace: true,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 30,
  },
  {
    name: "アイアンゲイザー",
    type: "martial",
    howToCalculate: "def",
    ratio: 2.15,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 33,
    ignoreEvasion: true,
  },
  {
    name: "アイアンロンド",
    type: "dance",
    howToCalculate: "def",
    ratio: 0.82,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 48,
    ignoreEvasion: true,
    ignoreDazzle: true,
    criticalHitProbability: 0,
  },
  {
    name: "ヒーロースパーク",
    type: "martial",
    howToCalculate: "fix",
    damage: 254,
    element: "light",
    targetType: "all",
    targetTeam: "enemy",
    hitNum: 2,
    MPcost: 100,
    lowHpDamageMultiplier: true,
    damageByLevel: true,
    ignoreReflection: true,
  },
  {
    name: "ばくれつドライブ",
    type: "martial",
    howToCalculate: "def",
    ratio: 0.82,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 60,
    ignoreProtection: true,
  },
  {
    name: "S・ブラスター",
    type: "martial",
    howToCalculate: "fix",
    damage: 146,
    element: "io",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 65,
    damageByLevel: true,
    appliedEffect: "divineWave",
  },
  {
    name: "インパクトキャノン",
    type: "spell",
    howToCalculate: "fix",
    damage: 700,
    element: "io",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 65,
    ignoreProtection: true,
  },
  {
    name: "キングストーム",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "wind",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 45,
    appliedEffect: { windResistance: { strength: -1, probability: 0.57 }, reviveBlock: { duration: 1 } },
    reviseIf: function (skillUser) {
      if (!hasEnoughMonstersOfType(parties[skillUser.teamID], "スライム", 5)) {
        return "キングストーム下位";
      }
    },
  },
  {
    name: "キングストーム下位",
    displayName: "キングストーム",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "wind",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 45,
    appliedEffect: { windResistance: { strength: -1, probability: 0.57 } },
  },
  {
    name: "メタ・マダンテ",
    type: "spell",
    howToCalculate: "MP",
    MPDamageRatio: 1.2,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcostRatio: 0.5,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    damageMultiplier: function (skillUser, skillTarget) {
      const reflectionMap = ["spellReflection", "slashReflection", "martialReflection", "breathReflection", "danceReflection", "ritualReflection"];
      let reflectionCount = 0;
      for (const reflectionBuff of reflectionMap) {
        if (skillTarget.buffs[reflectionBuff]) {
          reflectionCount++;
        }
      }
      if (reflectionCount >= 2) {
        return 7;
      } else if (reflectionCount === 1) {
        return 2.5;
      }
    },
  },
  {
    name: "オーバーホール",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    order: "anchor",
    MPcost: 80,
    isOneTimeUse: true,
    act: async function (skillUser, skillTarget) {
      for (const monster of parties[skillUser.teamID]) {
        if (monster.race.includes("物質")) {
          await reviveMonster(monster, 0.6, false, true); // 間隔skip
        } else {
          displayMiss(monster);
        }
      }
      await sleep(740);
    },
    selfAppliedEffect: async function (skillUser) {
      for (const monster of parties[skillUser.teamID]) {
        if (monster.race.includes("物質")) {
          applyBuff(monster, { matterBuffAtk: { strength: 0.3, divineDispellable: true, duration: 3 }, matterBuffSpd: { strength: 0.3, divineDispellable: true, duration: 3 } });
        }
      }
    },
  },
  {
    name: "グレネードボム",
    type: "breath",
    howToCalculate: "fix",
    damage: 534,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 2,
    MPcost: 54,
    ignoreProtection: true,
    appliedEffect: { fear: { probability: 0.5 } },
  },
  {
    name: "防衛指令",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    excludeTarget: (targetMonster) => !targetMonster.race.includes("物質"),
    MPcost: 32,
    appliedEffect: { revive: { keepOnDeath: true, divineDispellable: true, strength: 1 }, willSubstitute: { keepOnDeath: true, duration: 2, removeAtTurnStart: true } },
    act: async function (skillUser, skillTarget) {
      skillTarget.abilities.supportAbilities.nextTurnAbilities.push({
        act: async function (skillUser) {
          await executeSkill(skillUser, findSkillByName("特性発動用におうだち"), null, false, null, false, true, null);
        }, // 体技封じ無効 状態異常でも実行するかは不明 todo:物質限定化(target指定後死亡してランダム選択になった場合にも)
      });
    },
  },
  {
    name: "リーサルウェポン",
    type: "spell",
    howToCalculate: "int",
    minInt: 1,
    minIntDamage: 415,
    maxInt: 1,
    maxIntDamage: 415,
    skillPlus: 1.15,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 150,
    order: "anchor",
    damageMultiplier: function (skillUser, skillTarget) {
      if (hasEnoughMonstersOfType(parties[skillUser.teamID], "物質", 5)) {
        return 1.5; //todo: 反射時に1.5にならない
      }
    },
  },
  {
    name: "アイアンクロー",
    type: "slash",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 33,
    ignoreGuard: true,
    appliedEffect: { fear: {} },
  },
  {
    name: "起爆装置",
    type: "martial",
    howToCalculate: "fix",
    damage: 100,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    skipDeathCheck: true,
    skipAbnormalityCheck: true,
    MPcost: 0,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    ignorePowerCharge: true,
    ignoreBarrier: true,
  },
  {
    name: "トラウマトラップ爆発",
    type: "martial",
    howToCalculate: "fix",
    damage: 400,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    skipDeathCheck: true,
    skipAbnormalityCheck: true,
    MPcost: 0,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    ignorePowerCharge: true,
    ignoreBarrier: true,
    appliedEffect: "disruptiveWave",
  },
  {
    name: "羅刹斬",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.09,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 58,
    appliedEffect: "divineWave",
  },
  {
    name: "デッドリースパーク",
    type: "martial",
    howToCalculate: "fix",
    damage: 312,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 75,
    ignoreProtection: true,
  },
  {
    name: "破滅プロトコル",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 54,
    isOneTimeUse: true,
    order: "preemptive",
    preemptiveGroup: 1,
    act: function (skillUser, skillTarget) {
      // 自分にも付与
      if (skillTarget.race.includes("物質")) {
        applyBuff(skillTarget, { powerCharge: { strength: 1.5 }, isUnbreakable: { keepOnDeath: true, left: 1, name: "不屈の闘志" }, countDown: { count: 2, unDispellableByRadiantWave: true } });
      }
    },
  },
  {
    name: "真・闘気拳",
    type: "martial",
    howToCalculate: "atk",
    ratio: 2.15,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 52,
    ignoreSubstitute: true,
    followingSkill: "真・闘気拳後半",
  },
  {
    name: "真・闘気拳後半",
    type: "martial",
    howToCalculate: "fix",
    damage: 195,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreSubstitute: true,
    appliedEffect: "disruptiveWave",
  },
  {
    name: "真・グランドクルス",
    type: "martial",
    howToCalculate: "fix",
    damage: 460,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 90,
    isOneTimeUse: true,
    appliedEffect: { fear: { probability: 0.4233 } },
    afterActionAct: async function (skillUser) {
      await sleep(200);
      const randomMultiplier = Math.floor(Math.random() * 11) * 0.01 + 0.95;
      applyDamage(skillUser, 480 * randomMultiplier, 1, false, false, false, false, null);
      await checkRecentlyKilledFlagForPoison(skillUser);
      // 全滅させた後にも自傷と蘇生を実行
    },
  },
  {
    name: "ぶちのめす",
    type: "martial",
    howToCalculate: "atk",
    ratio: 0.92,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 55,
    appliedEffect: { defUp: { strength: -1, probability: 0.3 } },
    act: function (skillUser, skillTarget) {
      deleteUnbreakable(skillTarget);
    },
  },
  {
    name: "ろうじょうのかまえ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    excludeTarget: (targetMonster) => !targetMonster.race.includes("物質"),
    MPcost: 50,
    order: "preemptive",
    preemptiveGroup: 2,
    isOneTimeUse: true,
    act: function (skillUser, skillTarget) {
      if (skillTarget.race.includes("物質")) {
        applyBuff(skillTarget, { protection: { strength: 0.9, duration: 1, removeAtTurnStart: true } });
      } else {
        displayMiss(skillTarget);
      }
      applyBuff(skillUser, { protection: { strength: 0.9, duration: 1, removeAtTurnStart: true } });
    },
  },
  {
    name: "天界の守り",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 50,
    order: "preemptive",
    preemptiveGroup: 2,
    isOneTimeUse: true,
    appliedEffect: { protection: { strength: 0.9, duration: 1, removeAtTurnStart: true } },
  },
  {
    name: "報復の大嵐",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 130,
    maxInt: 1000,
    maxIntDamage: 280,
    skillPlus: 1,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 114,
    ignoreReflection: true,
    damageMultiplier: function (skillUser, skillTarget) {
      if (!skillUser.buffs.dodgeBuff || skillUser.buffs.dodgeBuff.strength !== 1) {
        return 3;
      }
    },
  },
  {
    name: "スパークプレス",
    type: "martial",
    howToCalculate: "def",
    ratio: 2.15,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 38,
    ignoreEvasion: true,
    ignoreDazzle: true,
    ignoreReflection: true,
    criticalHitProbability: 0,
    appliedEffect: "divineWave",
  },
  {
    name: "マテリアルガード",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 34,
    order: "preemptive",
    preemptiveGroup: 3,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, null, true);
    },
    selfAppliedEffect: async function (skillUser) {
      if (!skillUser.flags.hasUsedMaterialGuard && hasEnoughMonstersOfType(parties[skillUser.teamID], "物質", 5)) {
        await sleep(100);
        skillUser.flags.hasUsedMaterialGuard = true;
        applyBuff(skillUser, { damageLimit: { unDispellable: true, strength: 200, duration: 3 } });
      }
    },
  },
  {
    name: "アースクラッシュ",
    type: "martial",
    howToCalculate: "def",
    ratio: 0.84,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 38,
    criticalHitProbability: 0,
    ignoreEvasion: true,
    ignoreDazzle: true,
    appliedEffect: { fear: { probability: 0.32 } },
  },
  {
    name: "メルキドの守護神",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 114,
    order: "preemptive",
    preemptiveGroup: 2,
    act: async function (skillUser, skillTarget) {
      if (skillTarget.race.includes("物質")) {
        applyBuff(skillTarget, { protection: { strength: 0.34, duration: 2, removeAtTurnStart: true }, criticalGuard: { duration: 2, removeAtTurnStart: true } });
      }
    },
  },
  {
    name: "アンカースパーク",
    type: "martial",
    howToCalculate: "fix",
    damage: 440,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 58,
    order: "anchor",
    anchorBonus: 2,
  },
  {
    name: "トラウマトラップ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 5,
    MPcost: 18,
    isOneTimeUse: true,
    appliedEffect: { traumaTrap: { keepOnDeath: true, duration: 1, removeAtTurnStart: true, iconSrc: "deathAbility" } },
    act: async function (skillUser, skillTarget) {
      displayMessage(`${skillUser.name}は`, "みがまえた！");
      skillUser.abilities.additionalDeathAbilities.push({
        name: "トラウマトラップ爆発",
        message: function (skillUser) {
          displayMessage(`${skillUser.name} がチカラつき`, "トラウマトラップ の効果が発動！");
        },
        unavailableIf: (skillUser) => !skillUser.buffs.traumaTrap,
        isOneTimeUse: true,
        act: async function (skillUser) {
          await executeSkill(skillUser, findSkillByName("トラウマトラップ爆発"), null, false, null, false, true, null);
        },
      });
    },
  },
  {
    name: "アンカーラッシュ",
    type: "martial",
    howToCalculate: "atk",
    ratio: 1.4,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 65,
    order: "anchor",
    anchorBonus: 3,
    ignoreEvasion: true,
    ignoreDazzle: true,
  },
  {
    name: "ギガ・マホヘル",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 43,
    ignoreReflection: true,
    act: function (skillUser, skillTarget) {
      let damage = getRandomIntInclusive(94, 157);
      let damageModifier = 1;
      if (skillTarget.buffs.metal) {
        damage *= skillTarget.buffs.metal.strength;
        //メタルキラー処理
        if (skillUser.buffs.metalKiller && skillTarget.buffs.metal.isMetal) {
          damage *= skillUser.buffs.metalKiller.strength;
        }
      } else if (skillTarget.buffs.goddessLightMetal) {
        damage *= 0.75;
      }
      // ダメージ軽減
      if (skillTarget.buffs.protection) {
        damage *= 1 - skillTarget.buffs.protection.strength;
      }
      // 一族のつるぎ
      if (skillUser.buffs.weaponBuff) {
        damageModifier += skillUser.buffs.weaponBuff.strength;
      }
      if (skillTarget.buffs.weaponBuff) {
        damageModifier += skillTarget.buffs.weaponBuff.strength;
      }
      damage *= damageModifier;
      applyDamage(skillTarget, damage, 1, true, false, false, false, null);
    },
  },
  {
    name: "ギガ・マホトラ",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 32,
    ignoreReflection: true,
    act: function (skillUser, skillTarget) {
      const damage = getRandomIntInclusive(47, 53);
      applyDamage(skillTarget, damage, 1, true, false, false, false, null);
      applyHeal(skillUser, damage, true, true);
    },
  },
  {
    name: "オカルトソード",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.05,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 39,
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.paralyzed) {
        return 2;
      }
    },
    masoMultiplier: {
      1: 2,
      2: 2.1, // 推測
      3: 2.2,
      4: 2.3,
    },
    appliedEffect: { poisoned: { probability: 0.5 }, paralyzed: { probability: 0.2 } },
  },
  {
    name: "ダーティーショット",
    type: "martial",
    howToCalculate: "atk",
    ratio: 1.28,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 45,
    order: "preemptive",
    preemptiveGroup: 8,
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned || skillTarget.buffs.paralyzed) {
        return 3;
      }
    },
    masoMultiplier: {
      1: 3,
      2: 3.1, // 推測
      3: 3.2,
      4: 3.3,
    },
  },
  {
    name: "れっぱの息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 240,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 35,
  },
  {
    name: "プロト・スターフレア",
    type: "breath",
    howToCalculate: "fix",
    damage: 555,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 84,
  },
  {
    name: "氷撃波",
    type: "martial",
    howToCalculate: "def",
    ratio: 0.72,
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 70,
    criticalHitProbability: 0,
    ignoreEvasion: true,
    ignoreDazzle: true,
    appliedEffect: { fear: { probability: 0.2 } },
    damageMultiplier: function (skillUser, skillTarget) {
      if (skillUser.buffs.protection) {
        return skillUser.buffs.protection.strength * 2.5 + 1;
      } else {
        return 1;
      }
    },
  },
  {
    name: "ヴェノムパニック",
    type: "martial",
    howToCalculate: "fix",
    damage: 786,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 65,
    damageByLevel: true,
    appliedEffect: { poisoned: { probability: 1.5 } },
    damageMultiplier: function (skillUser, skillTarget, isReflection) {
      if (!isReflection && skillTarget.buffs.poisoned) {
        return 0.2; // 反射時は毒であろうと5倍
      }
    },
  },
  {
    name: "ドレッドダンス",
    type: "dance",
    howToCalculate: "fix",
    damage: 210,
    element: "dark",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 108,
    ignoreSubstitute: true,
    followingSkill: "ドレッドダンス後半",
  },
  {
    name: "ドレッドダンス後半",
    type: "dance",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreSubstitute: true,
    appliedEffect: { countDown: { count: 2, probability: 0.66 } },
  },
  {
    name: "劇毒のきり",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 39,
    ignoreReflection: true,
    ignoreSubstitute: true,
    appliedEffect: { poisoned: { unDispellableByRadiantWave: true } },
    followingSkill: "劇毒のきり後半",
  },
  {
    name: "劇毒のきり後半",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 0,
    ignoreReflection: true,
    ignoreSubstitute: true,
    appliedEffect: { poisoned: { unDispellableByRadiantWave: true } },
  },
  {
    name: "毒性深化",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 27,
    order: "preemptive",
    preemptiveGroup: 7,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreTypeEvasion: true,
    act: async function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisonDepth) {
        intensityPoisonDepth(skillTarget);
      } else {
        applyBuff(skillTarget, { poisonDepth: { keepOnDeath: true, strength: 3 } });
      }
    },
  },
  {
    name: "黄金のカギ爪",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.03,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 48,
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned || skillTarget.buffs.asleep || skillTarget.buffs.paralyzed) {
        return 2.5;
      }
    },
    masoMultiplier: {
      1: 2.5,
      2: 2.6, // 推測
      3: 2.7,
      4: 2.8,
    },
  },
  {
    name: "紫電の瘴気",
    type: "breath",
    howToCalculate: "fix",
    damage: 240,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 45,
    appliedEffect: { poisoned: { probability: 0.8 } },
  },
  {
    name: "ホラーブレス",
    type: "breath",
    howToCalculate: "fix",
    damage: 210,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 108,
    appliedEffect: { poisoned: { probability: 1 }, asleep: { probability: 0.3 } },
    followingSkill: "ホラーブレス後半",
  },
  {
    name: "ホラーブレス後半",
    type: "breath",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: { countDown: { count: 2, probability: 0.7 } },
  },
  {
    name: "黄泉がえりの舞い",
    type: "dance",
    howToCalculate: "none",
    element: "none",
    targetType: "dead",
    targetTeam: "ally",
    MPcost: 118,
    act: async function (skillUser, skillTarget) {
      await reviveMonster(skillTarget);
      applyBuff(skillTarget, { baiki: { strength: 1 }, defUp: { strength: 1 }, spdUp: { strength: 1 }, intUp: { strength: 1 } });
    },
  },
  {
    name: "ネクロゴンドの衝撃",
    type: "martial",
    howToCalculate: "fix",
    damage: 160,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 86,
    order: "preemptive",
    preemptiveGroup: 7,
    damageByLevel: true,
    appliedEffect: "divineWave",
  },
  {
    name: "ネクロゴンドの衝撃下位",
    displayName: "ネクロゴンドの衝撃",
    type: "martial",
    howToCalculate: "fix",
    damage: 160,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 86,
    damageByLevel: true,
    appliedEffect: "divineWave",
  },
  {
    name: "イオナフィスト",
    type: "martial",
    howToCalculate: "atk",
    ratio: 0.5,
    element: "io",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 130,
    ignoreBaiki: true,
    ignoreEvasion: true,
    ignorePowerCharge: true,
    criticalHitProbability: 1,
  },
  {
    name: "ジェノサイドストーム",
    type: "breath",
    howToCalculate: "fix",
    damage: 200,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 98,
    appliedEffect: { poisoned: { probability: 0.7 }, asleep: { probability: 0.25 } },
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned || skillTarget.buffs.asleep) {
        return 2.5;
      }
    },
    masoMultiplier: {
      1: 1.5,
      2: 1.6, // 推測
      3: 1.7,
      4: 1.8,
    },
  },
  {
    name: "漆黒の儀式",
    type: "ritual",
    howToCalculate: "fix",
    damage: 280,
    element: "dark",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 52,
    act: async function (skillUser, skillTarget) {
      if (skillTarget.buffs.countDown && skillTarget.buffs.countDown.count > 1) {
        skillTarget.buffs.countDown.count--;
      }
    },
  },
  {
    name: "れんごくの翼",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 65,
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned || skillTarget.buffs.asleep || skillTarget.buffs.confused || skillTarget.buffs.paralyzed) {
        return 2;
      }
    },
  },
  {
    name: "プロミネンス",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 150,
    maxInt: 600,
    maxIntDamage: 330,
    skillPlus: 1.06,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 120,
    ignoreSubstitute: true,
    appliedEffect: { dotDamage: { strength: 0.2 } },
    specialMessage: function (skillUserName, skillName) {
      displayMessage(`${skillUserName}は`, "プロミネンスを呼び出した！");
    },
  },
  {
    name: "時ゆがめる暗霧",
    type: "martial",
    howToCalculate: "fix",
    damage: 215,
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 75,
    damageByLevel: true,
    appliedEffect: { spdUp: { strength: -1, probability: 0.6 }, poisoned: { probability: 0.8 } },
  },
  {
    name: "邪悪な残り火",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    skipDeathCheck: true,
    skipSkillSealCheck: true,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    appliedEffect: { fear: { probability: 0.4775 } },
    followingSkill: "邪悪な残り火後半",
  },
  {
    name: "邪悪な残り火後半",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    skipDeathCheck: true,
    skipSkillSealCheck: true,
    appliedEffect: "disruptiveWave",
  },
  {
    name: "ヒートヴェノム",
    type: "breath",
    howToCalculate: "fix",
    damage: 40, //200
    damageMultiplierBySameRace: true,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 55,
    appliedEffect: { poisoned: { probability: 0.8 } },
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned) {
        return 2;
      }
    },
  },
  {
    name: "腐乱の波動",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 68,
    zakiProbability: 0.3683,
    followingSkill: "腐乱の波動後半",
  },
  {
    name: "腐乱の波動後半",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: { asleep: { probabilityMultiplierBySameRace: true, probability: 0.081 }, confused: { probabilityMultiplierBySameRace: true, probability: 0.0856 } },
    //0.405, 0.428
  },
  {
    name: "仁王溶かしの息",
    type: "breath",
    howToCalculate: "fix",
    damage: 145,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 78,
    substituteBreaker: 3,
  },
  {
    name: "メガントマータ",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 48,
    zakiProbability: 0.41,
    discription2: "ランダムに5回　イオ系の呪文攻撃",
    discription3: "確率で即死させる",
  },
  {
    name: "亡者の儀式",
    type: "ritual",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "anchor",
    MPcost: 152,
    act: async function (skillUser, skillTarget) {
      if (skillTarget.name === "デスソシスト") {
        displayMiss(skillTarget);
      } else {
        ascension(skillTarget);
      }
    },
    followingSkill: "亡者の儀式後半",
  },
  {
    name: "亡者の儀式後半",
    type: "ritual",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    order: "anchor",
    MPcost: 0,
    act: async function (skillUser, skillTarget) {
      for (const monster of parties[skillUser.teamID]) {
        if (monster.flags.isDead && !monster.buffs.reviveBlock) {
          await reviveMonster(monster, 1, false, true); // 間隔skip
          applyBuff(monster, { continuousMPHealing: { removeAtTurnStart: true, duration: 3 } });
        }
      }
      await sleep(740);
    },
  },
  {
    name: "六芒魔法陣",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "anchor",
    MPcost: 152,
    act: async function (skillUser, skillTarget) {
      if (skillTarget.name === "真・冥王ゴルゴナ") {
        displayMiss(skillTarget);
      } else {
        ascension(skillTarget);
      }
    },
    followingSkill: "六芒魔法陣後半",
  },
  {
    name: "六芒魔法陣後半",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    order: "anchor",
    MPcost: 0,
    act: async function (skillUser, skillTarget) {
      for (const monster of parties[skillUser.teamID]) {
        if (monster.flags.isDead && !monster.buffs.reviveBlock) {
          await reviveMonster(monster, 0.5, false, true); // 間隔skip
        }
      }
      await sleep(740);
    },
  },
  {
    name: "冥府の邪法",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "anchor",
    isOneTimeUse: true,
    MPcostRatio: 1,
    act: async function (skillUser, skillTarget) {
      if (skillTarget.name === "真・冥王ゴルゴナ") {
        displayMiss(skillTarget);
      } else {
        ascension(skillTarget);
      }
    },
    followingSkill: "冥府の邪法後半",
  },
  {
    name: "冥府の邪法後半",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 0,
    act: async function (skillUser, skillTarget) {
      for (const monster of parties[skillUser.teamID]) {
        if (monster.flags.isDead && !monster.buffs.reviveBlock) {
          await reviveMonster(monster, 0.5, false, true); // 間隔skip
        }
      }
      await sleep(740);
    },
    followingSkill: "冥府の邪法ボミオス",
  },
  {
    name: "冥府の邪法ボミオス",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    appliedEffect: { spdUp: { strength: -1, probability: 0.6 } },
  },
  {
    name: "ザオリーマ",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 200,
    isOneTimeUse: true,
    isHealSkill: true,
    act: async function (skillUser, skillTarget) {
      for (const monster of parties[skillUser.teamID]) {
        if (monster.flags.isDead && !monster.buffs.reviveBlock) {
          // 間隔skip 蘇生成功時に全回復表示
          if (await reviveMonster(monster, 1, false, true)) {
            displayDamage(monster, monster.defaultStatus.HP, -1);
          }
        } else {
          applyHeal(monster, monster.defaultStatus.HP, false, false);
        }
      }
      await sleep(400);
    },
  },
  {
    name: "鮮烈な稲妻",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 50,
    maxInt: 600,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 45,
    appliedEffect: { thunderResistance: { strength: -1, probability: 0.57 } },
  },
  {
    name: "ボーンスキュル",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.21,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 58,
    ignoreEvasion: true,
    afterActionAct: async function (skillUser) {
      await sleep(200);
      applyDamage(skillUser, 500, 1, false, false, false, false, null);
      await checkRecentlyKilledFlagForPoison(skillUser);
      // 全滅させた後にも自傷と蘇生を実行
    },
  },
  {
    name: "超魔改良",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 18,
    isOneTimeUse: true,
    appliedEffect: { powerCharge: { keepOnDeath: true, strength: 3, duration: 2, zombieBuffable: true } },
  },
  {
    name: "ヴェレマータ",
    type: "spell",
    howToCalculate: "int",
    minInt: 300,
    minIntDamage: 130,
    maxInt: 900,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 73,
    appliedEffect: { poisoned: { isLight: true, probability: 0.8 } },
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned) {
        return 1.2;
      }
    },
  },
  {
    name: "太陽神の鉄槌",
    type: "martial",
    howToCalculate: "fix",
    damage: 312,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 75,
    damageByLevel: true,
    appliedEffect: { poisoned: { probability: 0.8 }, asleep: { probability: 0.2 }, paralyzed: { probability: 0.2 } },
  },
  {
    name: "ファラオの幻刃",
    type: "slash",
    howToCalculate: "fix",
    damage: 395,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    ignoreEvasion: true, // マヌーサ有効
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned || skillTarget.buffs.dazzle) {
        return 3;
      }
    },
    masoMultiplier: {
      1: 1.5,
      2: 1.6, // 推測
      3: 1.7,
      4: 1.8,
    },
  },
  {
    name: "ファラオの召喚",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "dead",
    targetTeam: "ally",
    MPcost: 58,
    act: async function (skillUser, skillTarget) {
      await reviveMonster(skillTarget, 0.5);
      skillTarget.buffs.pharaohPower = { keepOnDeath: true }; //直接挿入
      skillTarget.attribute.additionalEvenTurnBuffs = {
        ...skillTarget.attribute.additionalEvenTurnBuffs,
        baiki: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      };
    },
  },
  {
    name: "業火のロンド",
    type: "dance",
    howToCalculate: "fix",
    damage: 208,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 60,
    appliedEffect: { paralyzed: { probability: 0.6 } },
  },
  {
    name: "非道の儀式",
    type: "ritual",
    howToCalculate: "fix",
    damage: 435,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 48,
    RaceBane: ["???"],
    RaceBaneValue: 5,
    damageByLevel: true,
    ignoreProtection: true,
  },
  {
    name: "闇討ちの魔弾",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 130,
    maxInt: 1000,
    maxIntDamage: 160,
    skillPlus: 1.15,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 53,
    order: "preemptive",
    preemptiveGroup: 8,
    appliedEffect: { manaReduction: { strength: 0.5, duration: 2 } },
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      applyBuff(skillUser, { dodgeBuff: { strength: 0.5 } });
    },
  },
  {
    name: "石化の呪い",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 54,
    isOneTimeUse: true,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    appliedEffect: { stoned: { duration: 2, isGolden: true } },
  },
  {
    name: "メラゾストーム",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 130,
    maxInt: 1000,
    maxIntDamage: 220,
    skillPlus: 1.09,
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 65,
    appliedEffect: { spellBarrier: { strength: -1, probability: 0.25 } },
  },
  {
    name: "死神の大鎌",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.3,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 50,
    zakiProbability: 0.4413,
    appliedEffect: { poisoned: { probability: 0.7 }, paralyzed: { probability: 0.4192 } },
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned || skillTarget.buffs.paralyzed) {
        return 2;
      }
    },
    masoMultiplier: {
      1: 1.5,
      2: 1.6, // 推測
      3: 1.7,
      4: 1.8,
    },
  },
  {
    name: "けがれの封印",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 98,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    act: async function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned) {
        applyBuff(skillTarget, { sealed: {} });
      } else {
        displayMiss(skillTarget);
      }
    },
  },
  {
    name: "毒滅の稲妻",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 106,
    maxInt: 600,
    maxIntDamage: 242,
    skillPlus: 1.15,
    element: "thunder",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 86,
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned) {
        return 1.5;
      }
    },
    masoMultiplier: {
      1: 1.5,
      2: 1.6, // 推測
      3: 1.7,
      4: 1.8,
    },
  },
  {
    name: "ポイズンバースト",
    type: "breath",
    howToCalculate: "fix",
    damage: 345,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 71,
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned) {
        return 2;
      }
    },
    masoMultiplier: {
      1: 1.2,
      2: 1.3, // 推測
      3: 1.4,
      4: 1.5,
    },
  },
  {
    name: "ザラキーマ",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 56,
    zakiProbability: 0.3554,
  },
  {
    name: "グランドアビス",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 108,
    appliedEffect: { reviveBlock: { duration: 1, zombieBuffable: true } },
    ignoreReflection: true,
    followingSkill: "グランドアビス後半",
    discription1: "【みかわし不可】【マヌーサ無効】【反射無視】敵全体を",
    discription2: "1ラウンドの間　蘇生封じ状態にし　その後　敵全体に",
    discription3: "ドルマ系の体技攻撃　HP25%未満なら威力1.2倍",
  },
  {
    name: "グランドアビス後半",
    type: "martial",
    howToCalculate: "fix",
    damage: 310,
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreReflection: true,
    damageModifier: function (skillUser, skillTarget) {
      const HPratio = skillUser.currentStatus.HP / skillUser.defaultStatus.HP;
      if (HPratio < 0.25) {
        return 0.2; //加算らしい
      } else {
        return 0;
      }
    },
  },
  {
    name: "再召喚の儀",
    type: "ritual",
    howToCalculate: "none",
    element: "none",
    targetType: "field",
    targetTeam: "ally",
    MPcost: 108,
    isOneTimeUse: true,
    act: async function (skillUser, skillTarget) {
      for (const monster of parties[skillUser.teamID]) {
        if (monster.flags.isDead && !monster.buffs.reviveBlock && !["???", "超魔王", "超伝説"].some((targetRace) => monster.race.includes(targetRace))) {
          await reviveMonster(monster, 1, false, true); // 間隔skip
          applyBuff(monster, { baiki: { strength: 2 }, defUp: { strength: 2 }, spdUp: { strength: 2 }, intUp: { strength: 2 }, countDown: { count: 2 } });
        }
      }
      await sleep(740);
    },
    selfAppliedEffect: async function (skillUser) {
      await sleep(150);
      applyBuff(skillUser, { revive: { keepOnDeath: true, divineDispellable: true, strength: 1 } });
    },
    discription1: "【戦闘中1回】???・超魔王・超伝説系以外の味方全体を",
    discription2: "復活させ　攻撃力・防御力・素早さ・賢さを　2段階上げ",
    discription3: "カウント2状態に　その後　自分を　自動復活状態にする",
  },
  {
    name: "修羅の闇",
    type: "breath",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 57,
    appliedEffect: { reviveBlock: { duration: 1, zombieBuffable: true }, healBlock: {}, zombifyBlock: { removeAtTurnStart: true, duration: 1 } },
    followingSkill: "修羅の闇後半",
  },
  {
    name: "修羅の闇後半",
    type: "breath",
    howToCalculate: "fix",
    damage: 370,
    element: "dark",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 0,
    hitNum: 3,
  },
  {
    name: "殺りくのツメ",
    type: "slash",
    howToCalculate: "def",
    ratio: 0.4,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 3,
    MPcost: 78,
    ignoreEvasion: true,
    ignoreProtection: true,
    ignoreSubstitute: true,
    criticalHitProbability: 1,
  },
  {
    name: "混沌のキバ",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.57,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 55,
  },
  {
    name: "名もなき儀式",
    type: "ritual",
    howToCalculate: "fix",
    damage: 210,
    element: "dark",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 8,
    MPcost: 62,
    ignoreProtection: true,
    ignoreGuard: true,
    appliedEffect: "divineWave",
  },
  {
    name: "災禍のマ瘴",
    type: "martial",
    howToCalculate: "fix",
    damage: 220,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 58,
    appliedEffect: { maso: { maxDepth: 4 }, martialSeal: { probability: 0.3 } },
    masoMultiplier: {
      1: 2,
      2: 3,
      3: 4,
      4: 5,
    },
  },
  {
    name: "レベル4ハザード",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 34,
    isOneTimeUse: true,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    appliedEffect: { maso: { strength: 4, maxDepth: 4 } },
  },
  {
    name: "マ素侵食",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 93,
    order: "preemptive",
    preemptiveGroup: 7,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreTypeEvasion: true,
    appliedEffect: { maso: { maxDepth: 3 }, powerWeaken: { strength: 0.5, duration: 3 }, manaReduction: { strength: 0.5, duration: 3 } },
    act: async function (skillUser, skillTarget) {
      applyBuff(skillTarget, { maso: { probability: 0.3, maxDepth: 3 } });
    },
  },
  {
    name: "マ素汚染",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 88,
    order: "preemptive",
    preemptiveGroup: 7,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreTypeEvasion: true,
    appliedEffect: { maso: { maxDepth: 3 } },
  },
  {
    name: "ハザードウェポン",
    type: "spell",
    howToCalculate: "fix",
    damage: 130,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 74,
    ignoreProtection: true,
    masoMultiplier: {
      1: 5,
      2: 6.5,
      3: 8,
      4: 9.5,
    },
    act: async function (skillUser, skillTarget) {
      if (skillTarget.buffs.maso && skillTarget.buffs.maso.strength < 5) {
        delete skillTarget.buffs.maso;
      }
    },
  },
  {
    name: "ダークハザード",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.66,
    element: "dark",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 45,
    ignoreReflection: true,
    ignoreEvasion: true,
    appliedEffect: { maso: { maxDepth: 4 } },
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.poisoned || skillTarget.buffs.paralyzed) {
        return 3;
      }
    },
    masoMultiplier: {
      1: 3,
      2: 3.2,
      3: 3.4,
      4: 3.6,
    },
  },
  {
    name: "ブレイクシステム",
    type: "martial",
    howToCalculate: "fix",
    damage: 10,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    skipAbnormalityCheck: true,
    hitNum: 10,
    MPcost: 0,
    ignoreReflection: true,
    ignoreTypeEvasion: true,
    ignorePowerCharge: true,
    ignoreBarrier: true,
    appliedEffect: { maso: { maxDepth: 3 } },
    masoMultiplier: {
      1: 2,
      2: 2.2,
      3: 2.4,
      4: 2.6,
    },
  },
  {
    name: "あらしの乱舞",
    type: "dance",
    howToCalculate: "fix",
    damage: 270,
    element: "thunder",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 48,
    order: "anchor",
    masoMultiplier: {
      1: 2,
      2: 3,
      3: 4,
      4: 5,
    },
  },
  {
    name: "マ素のはどう",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 46,
    appliedEffect: "disruptiveWave",
    followingSkill: "マ素のはどう後半",
  },
  {
    name: "マ素のはどう後半",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreReflection: true,
    appliedEffect: { maso: { maxDepth: 3 } },
  },
  {
    name: "こうせきおとし",
    type: "martial",
    howToCalculate: "fix",
    damage: 240,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 98,
    order: "anchor",
    damageByLevel: true,
    masoMultiplier: {
      1: 2,
      2: 3,
      3: 4,
      4: 5,
    },
  },
  {
    name: "マデュライトナックル",
    type: "martial",
    howToCalculate: "fix",
    damage: 290,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 32,
    damageByLevel: true,
    masoMultiplier: {
      1: 2,
      2: 2.2, // 推測
      3: 2.4,
      4: 2.6,
    },
  },
  {
    name: "マガデイン",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 140,
    maxInt: 500,
    maxIntDamage: 320,
    skillPlus: 1.15,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 64,
    ignoreReflection: true,
    ignoreProtection: true,
    masoMultiplier: {
      1: 2,
      2: 3,
      3: 4,
      4: 5,
    },
  },
  {
    name: "けがれた狂風",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 33,
    maxInt: 500,
    maxIntDamage: 66,
    skillPlus: 1.15,
    element: "wind",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 70,
    ignoreSubstitute: true,
    masoMultiplier: {
      1: 3,
      2: 3.1, // 推測
      3: 3.2,
      4: 3.3,
    },
    followingSkill: "けがれた狂風後半",
  },
  {
    name: "けがれた狂風後半",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
    ignoreSubstitute: true,
    ignoreTypeEvasion: true,
    appliedEffect: { maso: { maxDepth: 3 } },
  },
  {
    name: "プチマダンテ・凶",
    type: "spell",
    howToCalculate: "MP",
    MPDamageRatio: 3.6,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcostRatio: 0.3,
    ignoreReflection: true,
    appliedEffect: { maso: { strength: 3, maxDepth: 3 } },
  },
  {
    name: "マ瘴の爆発",
    type: "martial",
    howToCalculate: "fix",
    damage: 73,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 70,
    damageByLevel: true,
    appliedEffect: { paralyzed: { probability: 0.3 } },
    masoMultiplier: {
      1: 2,
      2: 3,
      3: 4,
      4: 5,
    },
  },
  {
    name: "バイオスタンプ",
    type: "martial",
    howToCalculate: "fix",
    damage: 136,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 44,
    damageByLevel: true,
    appliedEffect: { spdUp: { strength: -1, probability: 0.3 } }, //TODO: ブレイク4体限定
  },
  {
    name: "凶帝王の双閃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "io",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 45,
    appliedEffect: { maso: { maxDepth: 3 } },
    masoMultiplier: {
      1: 1.5,
      2: 1.7, // 推測
      3: 1.9,
      4: 2.1,
    },
    followingSkill: "凶帝王の一閃",
    additionalVersion: "凶帝王の一閃",
  },
  {
    name: "凶帝王の一閃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "io",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 45,
    appliedEffect: { maso: { maxDepth: 3 } },
    masoMultiplier: {
      1: 1.5,
      2: 1.7, // 推測
      3: 1.9,
      4: 2.1,
    },
  },
  {
    name: "爆炎の絶技",
    type: "slash",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 48,
    criticalHitProbability: 0,
    appliedEffect: { defUp: { strength: -1, probability: 0.4 } },
    masoMultiplier: {
      1: 1.5,
      2: 1.7,
      3: 1.9,
      4: 2.1,
    },
  },
  {
    name: "凶帝王のかまえ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    order: "preemptive",
    preemptiveGroup: 5,
    MPcost: 46,
    isOneTimeUse: true,
    appliedEffect: {
      powerCharge: { strength: 2 },
      manaBoost: { strength: 2 },
      slashReflection: { strength: 1.5, duration: 1, unDispellable: true, removeAtTurnStart: true, dispellableByAbnormality: true },
      martialReflection: { strength: 1.5, duration: 1, unDispellable: true, removeAtTurnStart: true, dispellableByAbnormality: true },
    },
  },
  {
    name: "結晶拳・疾風",
    type: "martial",
    howToCalculate: "fix",
    damage: 218,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 25,
    order: "preemptive",
    preemptiveGroup: 8,
    damageByLevel: true,
    masoMultiplier: {
      1: 2,
      2: 2.1, // 推測
      3: 2.2,
      4: 2.3,
    },
  },
  {
    name: "結晶拳・終",
    type: "martial",
    howToCalculate: "fix",
    damage: 230,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 2,
    MPcost: 85,
    order: "anchor",
    damageByLevel: true,
    masoMultiplier: {
      1: 2,
      2: 2.1, // 推測
      3: 2.2,
      4: 2.3,
    },
  },
  {
    name: "カオスストーム",
    type: "spell",
    howToCalculate: "int",
    minInt: 200,
    minIntDamage: 130,
    maxInt: 1000,
    maxIntDamage: 220,
    skillPlus: 1.09,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 75,
    appliedEffect: { fear: { probability: 0.36 } },
  },
  {
    name: "ピオリム",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 21,
    appliedEffect: { spdUp: { strength: 1 } },
  },
  {
    name: "ピオラ",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 8, //+0?
    appliedEffect: { spdUp: { strength: 2 } },
  },
  {
    name: "バイシオン",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 30,
    appliedEffect: { baiki: { strength: 1 } },
  },
  {
    name: "バイキルト",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 13,
    appliedEffect: { baiki: { strength: 2 } },
  },
  {
    name: "インテラ",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 15,
    appliedEffect: { intUp: { strength: 1 } },
  },
  {
    name: "スクルト",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 21,
    appliedEffect: { defUp: { strength: 1 } },
  },
  {
    name: "マジックバリア",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 10,
    appliedEffect: { spellBarrier: { strength: 1 } },
  },
  {
    name: "フバーハ",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 10,
    appliedEffect: { breathBarrier: { strength: 1 } },
  },
  {
    name: "ベホマラー",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 65,
    isHealSkill: true,
    act: async function (skillUser, skillTarget) {
      executeHealSkill(skillUser, skillTarget, 200, 110, 500, 272, 1.15);
    },
  },
  {
    name: "ベホマズン",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 200,
    isHealSkill: true,
    act: async function (skillUser, skillTarget) {
      executeHealSkill(skillUser, skillTarget, 200, 330, 500, 975, 1.15);
    },
  },
  {
    name: "チアフルダンス",
    type: "dance",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 50,
    isHealSkill: true,
    act: async function (skillUser, skillTarget) {
      executeHealSkill(skillUser, skillTarget, 200, 110, 500, 272, 1.15);
    },
    selfAppliedEffect: async function (skillUser) {
      for (const monster of parties[skillUser.teamID]) {
        if (Math.random() < 0.8) {
          applyBuff(monster, { defUp: { strength: 1 } });
          await sleep(100);
        }
      }
    },
  },
  {
    name: "いやしの光",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 64,
    isHealSkill: true,
    act: async function (skillUser, skillTarget) {
      executeHealSkill(skillUser, skillTarget, 200, 95, 500, 230, 1.15);
    },
    followingSkill: "光のはどう",
  },
  {
    name: "天の裁き",
    type: "martial",
    howToCalculate: "fix",
    damage: 123,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 62,
    damageByLevel: true,
    act: function (skillUser, skillTarget) {
      if (Math.random() < 0.83) {
        deleteUnbreakable(skillTarget);
      }
    },
  },
  {
    name: "しゃくねつ",
    type: "breath",
    howToCalculate: "fix",
    damage: 245,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 110,
  },
  {
    name: "体技封じの息",
    type: "breath",
    howToCalculate: "fix",
    damage: 75,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 32,
    appliedEffect: { martialSeal: { probability: 0.448 } },
  },
  {
    name: "メラシールド",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 36, //+なし
    order: "preemptive",
    preemptiveGroup: 2,
    appliedEffect: { elementalShield: { targetElement: "fire", remain: 250, unDispellable: true } },
  },
  {
    name: "斬撃よそく",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 5,
    order: "preemptive",
    preemptiveGroup: 5,
    appliedEffect: { slashReflection: { strength: 1.5, duration: 1, removeAtTurnStart: true, unDispellable: true, dispellableByAbnormality: true } },
  },
  {
    name: "やいばのまもり",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 32,
    order: "preemptive",
    preemptiveGroup: 5,
    appliedEffect: { slashReflection: { strength: 1.5, duration: 1, removeAtTurnStart: true, unDispellable: true, dispellableByAbnormality: true } },
  },
  {
    name: "体技よそく",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 5,
    order: "preemptive",
    preemptiveGroup: 5,
    appliedEffect: { martialReflection: { strength: 1.5, duration: 1, removeAtTurnStart: true, unDispellable: true, dispellableByAbnormality: true } },
  },
  {
    name: "踊りよそく",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 5,
    order: "preemptive",
    preemptiveGroup: 5,
    appliedEffect: { danceReflection: { strength: 1.5, duration: 1, removeAtTurnStart: true, unDispellable: true, dispellableByAbnormality: true } },
  },
  {
    name: "息よそく",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 5,
    order: "preemptive",
    preemptiveGroup: 5,
    appliedEffect: { breathReflection: { strength: 1.5, duration: 1, removeAtTurnStart: true, unDispellable: true, dispellableByAbnormality: true } },
  },
  {
    name: "超息よそく",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "self",
    targetTeam: "ally",
    MPcost: 15,
    order: "preemptive",
    preemptiveGroup: 5,
    appliedEffect: { breathReflection: { strength: 3, duration: 1, removeAtTurnStart: true, unDispellable: true, dispellableByAbnormality: true } },
  },
  {
    name: "リザオラル",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 120,
    appliedEffect: { revive: { keepOnDeath: true, strength: 0.65 } },
  },
  {
    name: "パンプキンタイフーン",
    type: "spell",
    howToCalculate: "int",
    minInt: 100,
    minIntDamage: 45,
    maxInt: 600,
    maxIntDamage: 135,
    skillPlus: 1.15,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 56,
    appliedEffect: { confused: { probability: 0.254 } },
  },
  {
    name: "聖魔拳",
    type: "martial",
    howToCalculate: "atk",
    ratio: 1.74,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    RaceBane: ["???"],
    RaceBaneValue: 2,
  },
  {
    name: "聖魔斬",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.74,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    RaceBane: ["???"],
    RaceBaneValue: 2,
  },
  {
    name: "閃光斬",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2,
    element: "io",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    RaceBane: ["???"],
    RaceBaneValue: 2,
  },
  {
    name: "ギガブレイク",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.4,
    element: "light",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 72,
  },
  {
    name: "炸裂斬",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.05,
    element: "io",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 48,
  },
  {
    name: "ジゴスパーク",
    type: "martial",
    howToCalculate: "fix",
    damage: 162,
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 65,
    appliedEffect: { paralyzed: { probability: 0.298 } },
  },
  {
    name: "獄炎斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.65,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    weakness18: true,
  },
  {
    name: "氷獄斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.65,
    element: "ice",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    weakness18: true,
  },
  {
    name: "轟雷斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.65,
    element: "thunder",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    weakness18: true,
  },
  {
    name: "暴風斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.65,
    element: "wind",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    weakness18: true,
  },
  {
    name: "爆砕斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.65,
    element: "io",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    weakness18: true,
  },
  {
    name: "極光斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.65,
    element: "light",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    weakness18: true,
  },
  {
    name: "暗獄斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.65,
    element: "dark",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 28,
    weakness18: true,
  },
  {
    name: "はやぶさ斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 2,
    MPcost: 21,
  },
  {
    name: "ゆうきの旋風",
    type: "breath",
    howToCalculate: "fix",
    damage: 328,
    element: "wind",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 83,
    followingSkill: "ゆうきの旋風後半",
  },
  {
    name: "ゆうきの旋風後半",
    type: "breath",
    howToCalculate: "fix",
    damage: 271,
    element: "light",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 0,
  },
  {
    name: "ほうしの嵐",
    type: "martial",
    howToCalculate: "fix",
    damage: 95,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 4,
    MPcost: 39,
    damageByLevel: true,
    appliedEffect: { asleep: { probability: 0.39 }, paralyzed: { probability: 0.1667 } },
    abnormalityMultiplier: function (skillUser, skillTarget) {
      if (skillTarget.buffs.asleep || skillTarget.buffs.paralyzed) {
        return 2;
      }
    },
    masoMultiplier: {
      1: 2,
      2: 2.1, // 推測
      3: 2.2,
      4: 2.3,
    },
  },
  {
    name: "クラスマダンテ",
    type: "spell",
    howToCalculate: "MP",
    MPDamageRatio: 3.45,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcostRatio: 1,
    ignoreReflection: true,
  },
  {
    name: "がんせきおとし",
    type: "martial",
    howToCalculate: "fix",
    damage: 240,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 98,
    damageByLevel: true,
  },
  {
    name: "しもふりおとし",
    type: "martial",
    howToCalculate: "fix",
    damage: 65,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 35,
    appliedEffect: { tempted: { probability: 0.2 } },
  },
  {
    name: "ステテコダンス",
    type: "dance",
    howToCalculate: "fix",
    damage: 162,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 41,
    ignoreDazzle: true, // みかわし有効
    appliedEffect: { confused: { probability: 0.404 } },
  },
  {
    name: "ベホマ",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 42,
    isHealSkill: true,
    act: async function (skillUser, skillTarget) {
      executeHealSkill(skillUser, skillTarget, 200, 330, 500, 975, 1.15);
    },
  },
  {
    name: "ベホイマ",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    MPcost: 42,
    isHealSkill: true,
    act: async function (skillUser, skillTarget) {
      executeHealSkill(skillUser, skillTarget, 200, 330, 500, 975, 1.15);
    },
  },
  {
    name: "debugbreath",
    type: "breath",
    howToCalculate: "fix",
    damage: 2000,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 10,
    ignoreProtection: true,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreGuard: true,
  },
  {},
];

const gear = [
  {
    name: "hoge",
    id: "hoge",
    weight: 5,
    noWeightMonsters: ["地獄の帝王エスターク"],
    status: { HP: 0, MP: 0, atk: 60, def: 0, spd: 15, int: 0 },
    statusMultiplier: { atk: 0.08, spd: -0.1 }, // lsと加算
    initialBuffs: { isUnbreakable: { keepOnDeath: true } }, // 戦闘開始時 演出なし
    turn1buffs: { dodgeBuff: { strength: 1 } }, // 演出あり
    alchemy: true, // 特定4系統の場合5%増加
    healBoost: 1.2, // 回復錬金
    skillAlchemy: "必殺の双撃", // 双撃は追撃の後半部分にも無理やり反映
    skillAlchemyStrength: 0.3, // 加算
    iceGearResistance: 2,
  },
  {
    name: "系統爪パニバリ",
    id: "familyNail",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 15, spd: 50, int: 0 },
    initialBuffs: { isUnbreakable: { keepOnDeath: true, left: 3, isToukon: true, name: "とうこん" }, confusionBarrier: { duration: 3 }, mindBarrier: { duration: 3 } },
  },
  {
    name: "系統爪暗夜",
    id: "familyNailBeast",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 15, spd: 50, int: 0 },
    initialBuffs: { isUnbreakable: { keepOnDeath: true, left: 3, isToukon: true, name: "とうこん" }, sleepBarrier: { duration: 3 }, mindBarrier: { duration: 3 } },
  },
  {
    name: "系統爪ザキ",
    id: "familyNailZaki",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 15, spd: 50, int: 0 },
    initialBuffs: { isUnbreakable: { keepOnDeath: true, left: 3, isToukon: true, name: "とうこん" } },
  },
  {
    name: "系統爪光の洗礼",
    id: "familyNailRadiantWave",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 15, spd: 50, int: 0 },
    initialBuffs: { isUnbreakable: { keepOnDeath: true, left: 3, isToukon: true, name: "とうこん" } },
  },
  {
    name: "系統爪会心完全ガード",
    id: "familyNailCriticalGuard",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 15, spd: 50, int: 0 },
    initialBuffs: { isUnbreakable: { keepOnDeath: true, left: 3, isToukon: true, name: "とうこん" }, criticalGuard: { unDispellable: true, duration: 3 } },
  },
  {
    name: "系統爪超魔王錬金",
    id: "familyNailTyoma",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 15, spd: 50, int: 0 },
    initialBuffs: { isUnbreakable: { keepOnDeath: true, left: 3, isToukon: true, name: "とうこん" } },
  },
  {
    name: "系統爪ザキ&防御力20%",
    id: "familyNailSlime",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 15, spd: 50, int: 0 },
  },
  {
    name: "エビルクロー",
    id: "evilClaw",
    weight: 500,
    status: { HP: 0, MP: 0, atk: 20, def: 0, spd: 55, int: 0 },
  },
  {
    name: "おうごんのツメ", //+10
    id: "goldenNail",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 53, int: 0 },
  },
  {
    name: "源氏の小手", //+10
    id: "genjiNail",
    weight: 5,
    noWeightMonsters: ["氷炎の化身", "降臨しんりゅう", "狂える賢者ベヒーモス", "幻獣バハムート", "幻獣オーディン", "降臨オメガ"],
    status: { HP: 0, MP: 0, atk: 0, def: 10, spd: 55, int: 0 },
  },
  {
    name: "ハザードネイル", //+15
    id: "hazardNail",
    weight: 5,
    noWeightMonsters: [
      "ガルマザード",
      "ガルマッゾ",
      "凶帝王エスターク",
      "凶ライオネック",
      "凶ブオーン",
      "凶ウルトラメタキン",
      "凶メタルキング",
      "凶グレートオーラス",
      "凶シーライオン",
      "凶アンドレアル",
    ],
    status: { HP: 0, MP: 0, atk: 0, def: 15, spd: 50, int: 0 },
  },
  {
    name: "メタルキングの爪", //+10
    id: "metalNail",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 15, def: 0, spd: 56, int: 0 },
    initialBuffs: { metalKiller: { keepOnDeath: true, strength: 1.5 } },
    alchemy: true,
  },
  {
    name: "竜神のツメ", //+10
    id: "ryujinNail",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 42, int: 0 },
    alchemy: true,
  },
  {
    name: "呪われし爪", //+10
    id: "cursedNail",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 42, int: 0 },
    statusMultiplier: { def: -0.2 },
    alchemy: true,
  },
  {
    name: "はどうのツメ", //+10
    id: "waveNail",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 34, int: 0 },
    alchemy: true,
  },
  {
    name: "奮起のツメ", //+2
    id: "hunkiNail",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 34, int: 0 },
    turn1buffs: { powerCharge: { strength: 1.1 } },
    alchemy: true,
  },
  {
    name: "大剣豪のつるぎ", //+10
    id: "daikengou",
    weight: 20,
    status: { HP: 0, MP: 0, atk: 90, def: 30, spd: 0, int: 0 },
    initialBuffs: { slashReflection: { unDispellable: true, strength: 1, removeAtTurnStart: true, duration: 3, isKanta: true } },
    //"hoge.nameは かまえをといた！"
  },
  {
    name: "かがやく魔神剣", //+10 絶技8
    id: "dreamSword",
    weight: 5,
    noWeightMonsters: ["魔神ダークドレアム"],
    status: { HP: 0, MP: 0, atk: 60, def: 0, spd: 15, int: 0 },
    skillAlchemy: "真・魔神の絶技",
    skillAlchemyStrength: 0.08,
  },
  {
    name: "帝王のつるぎ", //+10
    id: "estaSword",
    weight: 5,
    noWeightMonsters: ["地獄の帝王エスターク"],
    status: { HP: 0, MP: 0, atk: 65, def: 0, spd: 0, int: 0 },
    statusMultiplier: { atk: 0.08, spd: -0.1 },
    skillAlchemy: "必殺の双撃",
    skillAlchemyStrength: 0.3,
  },
  {
    name: "凶帝王のつるぎ", //+15 イオ25% 双閃追加 マソ8%
    id: "cursedestaSword",
    weight: 5,
    noWeightMonsters: ["凶帝王エスターク"],
    status: { HP: 0, MP: 0, atk: 70, def: 0, spd: 0, int: 0 },
  },
  {
    name: "トリリオンダガー", //+7 斬撃3%
    id: "tririon",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 17, def: 0, spd: 30, int: 0 },
    initialBuffs: { spdUp: { keepOnDeath: true, strength: 1 } },
  },
  {
    name: "ロトのつるぎ", //+10
    id: "rotoSword",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 45, def: 0, spd: 20, int: 0 },
  },
  {
    name: "勇者のつるぎ", //+10 会心5はない
    id: "yuushaken",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 45, def: 0, spd: 20, int: 0 },
    statusMultiplier: { atk: 0.08 },
    initialBuffs: { lightBreak: { keepOnDeath: true, strength: 1, removeAtTurnStart: true, duration: 3, iconSrc: "lightBreakdivineDispellable" } },
  },
  {
    name: "キラーピアス", //+10
    id: "killerEarrings",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 40, def: 0, spd: 10, int: 0 },
    alchemy: true,
  },
  {
    name: "心砕きのヤリ", //+2
    id: "kudaki",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 22, def: 0, spd: 15, int: 0 },
  },
  {
    name: "昇天のヤリ", //+2
    id: "shoten",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 23, def: 0, spd: 0, int: 28 },
  },
  {
    name: "りゅうおうの杖", //+15
    id: "dragonCane",
    weight: 5,
    noWeightMonsters: ["りゅうおう", "竜王"],
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 116 },
    statusMultiplier: { spd: -0.2 },
    initialBuffs: { revive: { strength: 1, keepOnDeath: true, unDispellable: true, iconSrc: "revivedivineDispellable" } },
    skillAlchemy: "咆哮",
    skillAlchemyStrength: 0.25,
  },
  {
    name: "りゅうおうの杖非素早さ錬金", //+15
    id: "dragonCaneWithoutSpd",
    weight: 5,
    noWeightMonsters: ["りゅうおう", "竜王"],
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 116 },
    initialBuffs: { revive: { strength: 1, keepOnDeath: true, unDispellable: true, iconSrc: "revivedivineDispellable" } },
    skillAlchemy: "咆哮",
    skillAlchemyStrength: 0.25,
  },
  {
    name: "しゅくふくの杖", //+10
    id: "shukuhuku",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 84 },
    healBoost: 1.32,
  },
  {
    name: "いかずちの杖", //+10
    id: "thunderCane",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 84 },
  },
  {
    name: "賢者の杖", //+10
    id: "ioCane",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 84 },
  },
  {
    name: "まがんの杖", //+10
    id: "darkCane",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 84 },
  },
  {
    name: "にちりんのこん", //+10
    id: "nitirin",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 38, def: 0, spd: 0, int: 24 },
  },
  {
    name: "ようせいの杖", //+10
    id: "lightCane",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 68 },
  },
  {
    name: "マグマの杖", //+10
    id: "fireCane",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 68 },
  },
  {
    name: "うみなりの杖", //+10
    id: "iceCane",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 68 },
  },
  {
    name: "うみなりの杖悪魔錬金", //+10
    id: "iceCaneDevil",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 68 },
  },
  {
    name: "さばきの杖", //+10
    id: "windCane",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 68 },
  },
  {
    name: "獣王グレイトアックス", //+10 回復錬金
    id: "ioCounter",
    weight: 5,
    noWeightMonsters: ["獣王クロコダイン"],
    status: { HP: 0, MP: 0, atk: 45, def: 40, spd: 0, int: 0 },
  },
  {
    name: "メガトンハンマー", //+10 回復錬金
    id: "megaton",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 34, def: 32, spd: 0, int: 0 },
    healBoost: 1.12,
  },
  {
    name: "魔神のかなづち", //+10
    id: "kanazuchi",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 34, def: 32, spd: 0, int: 0 },
  },
  {
    name: "ボーンクラッシャー", //+10
    id: "bonecrasher",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 28, def: 24, spd: 0, int: 0 },
  },
  {
    name: "源氏の盾", //+10 錬金なし
    id: "genjiShield",
    weight: 5,
    noWeightMonsters: ["氷炎の化身", "降臨しんりゅう", "狂える賢者ベヒーモス", "幻獣バハムート", "幻獣オーディン", "降臨オメガ"],
    status: { HP: 0, MP: 0, atk: 0, def: 105, spd: 0, int: 0 },
    initialBuffs: { spellBarrier: { strength: 2 } },
  },
  {
    name: "聖王の大盾", //+10 デイン5軽減
    id: "holyKingShield",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 0, def: 105, spd: 0, int: 0 },
    lightGearResistance: 2,
  },
  {
    name: "プラチナシールド", //+10 メラ息10軽減
    id: "platinumShield",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 0, def: 84, spd: 0, int: 0 },
    fireGearResistance: 1,
  },
  {
    name: "オーガシールド", //+10 錬金なし
    id: "thunderShield",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 0, def: 84, spd: 0, int: 0 },
    thunderGearResistance: 2,
  },
  {
    name: "こおりの盾", //+10 錬金なし
    id: "iceShield",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 0, def: 68, spd: 0, int: 0 },
    iceGearResistance: 2,
  },
  {
    name: "呪われし盾", //+10 体技5軽減
    id: "cursedShield",
    weight: 1,
    status: { HP: 0, MP: 0, atk: 0, def: 84, spd: 0, int: 0 },
    statusMultiplier: { spd: -0.2 },
  },
  {
    name: "狭間の闇の大剣", //+10 35%軽減
    id: "hazamaSword",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 50, def: 15, spd: 0, int: 0 },
  },
  {
    name: "狭間の闇のヤリ", //+10 35%軽減
    id: "hazamaSpear",
    weight: 5,
    status: { HP: 40, MP: 0, atk: 40, def: 0, spd: 0, int: 0 },
  },
  {
    name: "狭間の闇の盾", //+10 35%軽減
    id: "hazamaShield",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 0, def: 95, spd: 0, int: 0 },
  },
  {
    name: "狭間の闇のうでわ", //+10 35%軽減
    id: "hazamaBracelet",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 0, def: 20, spd: 30, int: 0 },
  },
  {
    name: "天空のフルート", //+10
    id: "flute",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 30, def: 60, spd: 0, int: 0 },
    turn1buffs: { dodgeBuff: { strength: 1 } },
  },
  {
    name: "天空の衣", //+10
    id: "heavenlyClothes",
    weight: 5,
    status: { HP: 0, MP: 0, atk: 0, def: 105, spd: 0, int: 0 },
    turn1buffs: { danceEvasion: { unDispellable: true, duration: 1, removeAtTurnStart: true } },
  },
  {
    name: "あぶない水着", //+10
    id: "swimSuit",
    weight: 5,
    noWeightMonsters: ["真夏の女神クシャラミ", "常夏少女ジェマ", "魔夏姫アンルシア", "涼風の魔女グレイツェル", "ドラ猫親分ドラジ"],
    status: { HP: 0, MP: 0, atk: 0, def: 1, spd: 45, int: 0 },
  },
  {
    name: "ゾーマのローブ", //+15 偶数真いては ダメージ半減
    id: "zomaRobe",
    weight: 5,
    noWeightMonsters: ["闇の大魔王ゾーマ"],
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 24, int: 58 },
  },
  {
    name: "輝石のベルト", //+7
    id: "pharaohBelt",
    weight: 5,
    status: { HP: 17, MP: 0, atk: 0, def: 0, spd: 0, int: 0 },
  },
  {
    name: "狭間の闇のはごろも", //+10
    id: "hazamaClothes",
    weight: 10,
    status: { HP: 0, MP: 0, atk: 0, def: 95, spd: 0, int: 0 },
    initialBuffs: { allElementalBreak: { strength: 1, keepOnDeath: true, iconSrc: "none" } },
  },
  {
    name: "ピエロの帽子", //+10
    id: "clownHat",
    weight: 2,
    status: { HP: 20, MP: 0, atk: 0, def: 0, spd: 0, int: 0 },
  },
  {
    name: "ファラオの腕輪",
    id: "pharaohBracelet",
    weight: 2,
    status: { HP: 0, MP: 0, atk: 37, def: 0, spd: 10, int: 0 },
  },
  {
    name: "炎よけのおまもり", //+10
    id: "fireCharm",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 20, int: 0 },
    fireGearResistance: 2,
  },
  {
    name: "氷よけのおまもり",
    id: "iceCharm",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 20, int: 0 },
    iceGearResistance: 2,
  },
  {
    name: "雷よけのおまもり",
    id: "thunderCharm",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 20, int: 0 },
    thunderGearResistance: 2,
  },
  {
    name: "風よけのおまもり",
    id: "windCharm",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 20, int: 0 },
    windGearResistance: 2,
  },
  {
    name: "爆発よけのおまもり",
    id: "ioCharm",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 20, int: 0 },
    ioGearResistance: 2,
  },
  {
    name: "光よけのおまもり",
    id: "lightCharm",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 20, int: 0 },
    lightGearResistance: 2,
  },
  {
    name: "闇よけのおまもり",
    id: "darkCharm",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 20, int: 0 },
    darkGearResistance: 2,
  },
  {
    name: "強戦士ハート・闇",
    id: "devilSpellHeart",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 0 },
  },
  {
    name: "パラディンハート・蒼",
    id: "slimeHeart",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 10, int: 0 },
  },
  {
    name: "盗賊ハート・闇",
    id: "devilSpdHeart",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 15, int: 0 },
  },
  {
    name: "盗賊ハート・獣",
    id: "beastSpdHeart",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 10, int: 0 },
  },
  {
    name: "闇の覇者ハート",
    id: "tyoryuHeart",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 10, int: 0 },
  },
  {
    name: "竜のうろこ",
    id: "dragonScale",
    weight: 0,
    status: { HP: 8, MP: 0, atk: 0, def: 0, spd: 0, int: 0 },
    fireGearResistance: 1,
  },
  {
    name: "シルバーフェザー",
    id: "silverFeather",
    weight: 0,
    status: { HP: 0, MP: 8, atk: 0, def: 0, spd: 0, int: 0 },
  },
  {
    name: "りせいのサンダル",
    id: "sandals",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 8, int: 0 },
  },
  {
    name: "クラブオーブ",
    id: "clubOrb",
    weight: 0,
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 15, int: 0 },
  },
];

// 必要ならばasyncにするのに注意
const gearAbilities = {
  waveNail: {
    initialAbilities: async function (skillUser) {
      skillUser.skill[3] = "プチ神のはどう";
    },
  },
  rotoSword: {
    initialAbilities: async function (skillUser) {
      if (!skillUser.abilities.reviveAct) {
        applyBuff(skillUser, { revive: { keepOnDeath: true, unDispellable: true, strength: 0.05, act: "ロトの加護", iconSrc: "revivedivineDispellable" } });
        skillUser.abilities.reviveAct = async function (monster, buffName) {
          if (buffName === "ロトの加護") {
            applyBuff(monster, { baiki: { strength: 1 }, defUp: { strength: 1 }, spdUp: { strength: 1 }, intUp: { strength: 1 } });
          }
        };
      }
    },
  },
  clownHat: {
    initialAbilities: async function (skillUser) {
      // 装備で上書き
      skillUser.abilities.counterAbilities = [
        {
          name: "帽子反撃",
          message: function (skillUser) {
            displayMessage("そうびの特性が 発動！");
          },
          act: async function (skillUser, counterTarget) {
            await executeWave(skillUser);
            await executeWave(counterTarget);
          },
        },
      ];
    },
  },
  ioCounter: {
    initialAbilities: async function (skillUser) {
      // 装備で上書き
      skillUser.abilities.counterAbilities = [
        {
          name: "グレイトアックス反撃",
          message: function (skillUser) {
            displayMessage(`${skillUser.name}の 反撃！`);
          },
          act: async function (skillUser, counterTarget) {
            await executeSkill(skillUser, findSkillByName("グレイトアックス反撃"), counterTarget);
          },
        },
      ];
    },
  },
  pharaohBracelet: {
    initialAbilities: async function (skillUser) {
      if (skillUser.race.includes("ゾンビ")) {
        skillUser.buffs.pharaohPower = { keepOnDeath: true }; //直接挿入
        skillUser.attribute.additionalEvenTurnBuffs = {
          ...skillUser.attribute.additionalEvenTurnBuffs,
          baiki: { strength: 1 },
          spdUp: { strength: 1 },
          intUp: { strength: 1 },
        };
      }
    },
  },
  pharaohBelt: {
    initialAbilities: async function (skillUser) {
      skillUser.buffs.pharaohPower = { keepOnDeath: true }; //直接挿入
      skillUser.attribute.additionalEvenTurnBuffs = {
        ...skillUser.attribute.additionalEvenTurnBuffs,
        baiki: { strength: 1 },
        spdUp: { strength: 1 },
        intUp: { strength: 1 },
      };
    },
  },
  familyNailRadiantWave: {
    // 直接挿入で良いのか 存在しない場合生成
    initialAbilities: async function (skillUser) {
      if (!skillUser.abilities.supportAbilities.evenTurnAbilities) {
        skillUser.abilities.supportAbilities.evenTurnAbilities = [];
      }
      skillUser.abilities.supportAbilities.evenTurnAbilities.push({
        name: "光の洗礼",
        message: function (skillUser) {
          displayMessage("そうびの特性により", "光の洗礼 が発動！");
        },
        act: async function (skillUser) {
          await executeRadiantWave(skillUser, false, true);
        },
      });
    },
  },
  silverFeather: {
    initialAbilities: async function (skillUser) {
      if (!skillUser.abilities.supportAbilities[3]) {
        skillUser.abilities.supportAbilities[3] = [];
      }
      skillUser.abilities.supportAbilities[3].push({
        name: "シルバーフェザー",
        message: function (skillUser) {
          displayMessage("そうびの特性が発動！");
        },
        act: async function (skillUser) {
          applyHeal(skillUser, 60, true);
        },
      });
    },
  },
  sandals: {
    initialAbilities: async function (skillUser) {
      skillUser.attribute.additionalPermanentBuffs.dodgeBuff = { strength: 1, probability: 0.05, noMissDisplay: true };
    },
  },
  clubOrb: {
    initialAbilities: async function (skillUser) {
      skillUser.attribute.additionalPermanentBuffs.martialBarrier = { strength: 1, probability: 0.25, noMissDisplay: true };
    },
  },
};

function executeHealSkill(skillUser, skillTarget, minInt, minIntHealAmount, maxInt, maxIntHealAmount, skillPlus = 1.15) {
  const int = skillUser.currentStatus.int;
  const randomMultiplier = Math.floor(Math.random() * 11) * 0.01 + 0.95;
  let healAmount;
  if (int < minInt) {
    healAmount = minIntHealAmount;
  } else if (int > maxInt) {
    healAmount = maxIntHealAmount;
  } else {
    healAmount = ((int - minInt) * (maxIntHealAmount - minIntHealAmount)) / (maxInt - minInt) + Number(minIntHealAmount);
  }
  healAmount *= skillPlus;
  healAmount *= randomMultiplier;
  // 回復のコツ
  if (skillUser.buffs.healEnhancement) {
    healAmount *= 1.15;
  }
  applyHeal(skillTarget, healAmount);
}

//画像の暗転と無効化 trueで暗転
function toggleDarkenAndClick(imgElement, enable) {
  if (enable) {
    // 画像を暗くする
    imgElement.style.filter = "brightness(40%)";
    // ポインターイベントを無効化
    imgElement.style.pointerEvents = "none";
  } else {
    // 元の明るさに戻す
    imgElement.style.filter = "brightness(100%)";
    // ポインターイベントを有効化
    imgElement.style.pointerEvents = "auto";
  }
}

function findSkillByName(skillName) {
  // グローバル変数 skill を参照して、一致するスキルを検索
  return skill.find((skill) => skill.name === skillName);
}

function displayDamage(monster, damage, resistance = 1, isMPdamage = false, reducedByElementalShield = false, isCriticalHit = false) {
  const monsterIcon = document.getElementById(monster.iconElementId);

  if (damage === 0 && !reducedByElementalShield && resistance !== -1) {
    // 回復ではなく、障壁以外でダメージ0の場合はmissを表示
    const missImage = document.createElement("img");
    missImage.src = "images/systems/miss.png";
    missImage.style.position = "absolute";
    missImage.style.width = monsterIcon.offsetWidth + "px";
    missImage.style.height = "auto";
    missImage.style.top = "50%";
    missImage.style.left = "50%";
    missImage.style.transform = "translate(-50%, -50%)";
    monsterIcon.parentElement.appendChild(missImage);

    // missImageのアニメーション
    setTimeout(() => {
      missImage.style.transition = "transform 0.04s ease-in-out";
      const currentTransform = missImage.style.transform;
      missImage.style.transform = `${currentTransform} translateY(-15%)`;
      setTimeout(() => {
        missImage.style.transform = currentTransform;
        setTimeout(() => {
          missImage.remove();
        }, 200);
      }, 40);
    }, 60);
  } else {
    // ミス以外の場合、ダメージ/回復画像と数値を表示 回復0や障壁0を含む
    // ダメージ効果画像と数値画像をまとめる全体コンテナを作成
    const damageEffectContainer = document.createElement("div");
    damageEffectContainer.style.position = "absolute";
    damageEffectContainer.style.top = "50%";
    damageEffectContainer.style.left = "50%";
    damageEffectContainer.style.transform = "translate(-50%, -50%)";

    // ダメージ数値のコンテナ部分
    const damageContainer = document.createElement("div");
    damageContainer.style.position = "relative";
    damageContainer.style.display = "flex";
    damageContainer.style.justifyContent = "center";

    // ダメージ/回復効果画像を設定
    let effectImagePath = "";
    if (resistance === -1) {
      // 回復の場合
      effectImagePath = isMPdamage ? "images/systems/effectImages/MPRecovery.png" : "images/systems/effectImages/HPRecovery.png";
    } else {
      // ダメージの場合
      effectImagePath = isMPdamage
        ? "images/systems/effectImages/enemyDamaged.png" //MPDamaged?
        : monster.teamID === 0
        ? "images/systems/effectImages/allyDamaged.png"
        : "images/systems/effectImages/enemyDamaged.png";

      // 耐性によって画像を変更 (HPダメージの場合のみ)
      if (!isMPdamage) {
        if (resistance === 1.5) {
          effectImagePath = monster.teamID === 0 ? "images/systems/effectImages/allyDamagedWeakness.png" : "images/systems/effectImages/enemyDamagedWeakness.png";
        } else if (resistance === 2) {
          effectImagePath = monster.teamID === 0 ? "images/systems/effectImages/allyDamagedSuperWeakness.png" : "images/systems/effectImages/enemyDamagedSuperWeakness.png";
        } else if (resistance === 2.5) {
          effectImagePath = monster.teamID === 0 ? "images/systems/effectImages/allyDamagedUltraWeakness.png" : "images/systems/effectImages/enemyDamagedUltraWeakness.png";
        }
      }
    }
    // 効果画像部分
    const effectImage = document.createElement("img");
    effectImage.src = effectImagePath;
    effectImage.style.position = "absolute";
    let scale = 1;
    if (resistance > 1.4 || (isCriticalHit && resistance !== -1)) {
      scale = 2;
    } else if (resistance === -1) {
      scale = 0.8;
    }
    effectImage.style.width = monsterIcon.offsetWidth * scale + "px";
    effectImage.style.height = "auto";
    // effectImage を damageEffectContainer の中心に配置
    effectImage.style.top = "50%";
    effectImage.style.left = "50%";
    effectImage.style.transform = "translate(-50%, -50%)";

    // 既に表示されているダメージエフェクトの数を取得
    const existingDamageEffects = monsterIcon.parentElement.querySelectorAll('div[style*="translate(-50%, -50%)"], img[src*="Damaged"], img[src*="MPDamaged"]').length;

    // ダメージエフェクトが既に存在する場合はランダムな位置にずらす
    if (resistance !== -1 && existingDamageEffects > 1) {
      const randomOffsetX = Math.floor(Math.random() * 21) - 10; // -10px から 10px までのランダムな値
      const randomOffsetY = Math.floor(Math.random() * 21) - 10;
      damageEffectContainer.style.transform = `translate(-50%, -50%) translate(${randomOffsetX}px, ${randomOffsetY}px)`; // コンテナごとずらす
    }

    // isCriticalHitがtrueのとき文字列を表示
    if (isCriticalHit && !isMPdamage && resistance !== -1) {
      const criticalTextContainer = document.createElement("div");
      criticalTextContainer.style.position = "absolute";
      criticalTextContainer.style.whiteSpace = "nowrap";
      criticalTextContainer.style.top = "-250%"; // 効果画像の上部に配置
      criticalTextContainer.style.left = "50%";
      criticalTextContainer.style.textAlign = "center"; // 文字列を中央揃え
      criticalTextContainer.style.textShadow =
        "black 0.3px 0px 0.7px, black -0.3px 0px 0.7px, black 0px -0.3px 0.7px, black 0px 0.3px 0.7px, black 0.3px 0.3px 0.7px, black -0.3px 0.3px 0.7px, black 0.3px -0.3px 0.7px, black -0.3px -0.3px 0.7px";
      criticalTextContainer.style.fontfamily = "Hiragino Maru Gothic ProN";
      criticalTextContainer.style.webkittextstroke = "1.5px black";
      criticalTextContainer.style.fontSize = "1rem"; // フォントサイズを調整
      criticalTextContainer.style.fontWeight = "bold"; // 太字に
      criticalTextContainer.style.transform = "translateX(-50%) rotate(-5deg)";
      criticalTextContainer.style.zIndex = "5";
      const firstLine = document.createElement("div");
      const secondLine = document.createElement("div");
      if (monster.teamID === 1) {
        firstLine.textContent = "かいしんの";
        criticalTextContainer.style.color = "#1fbaf8";
        effectImage.src = "images/systems/effectImages/enemyDamagedCritical.png";
      } else {
        firstLine.textContent = "つうこんの";
        criticalTextContainer.style.color = "#e14f1e";
        effectImage.src = "images/systems/effectImages/allyDamagedCritical.png";
      }
      secondLine.textContent = "いちげき !!";
      secondLine.style.marginTop = "-5px";
      criticalTextContainer.appendChild(firstLine);
      criticalTextContainer.appendChild(secondLine);
      damageEffectContainer.appendChild(criticalTextContainer); // コンテナに追加
    }

    // 子要素を追加
    damageEffectContainer.appendChild(effectImage);
    damageEffectContainer.appendChild(damageContainer);
    monsterIcon.parentElement.appendChild(damageEffectContainer);

    // ダメージ/回復量の数値画像を生成
    const digits = Math.abs(damage).toString().split("");
    for (let i = 0; i < digits.length; i++) {
      const digitImage = document.createElement("img");
      digitImage.src =
        resistance === -1
          ? isMPdamage
            ? `images/systems/MPRecoveryNumbers/${digits[i]}.png`
            : `images/systems/HPRecoveryNumbers/${digits[i]}.png`
          : isMPdamage
          ? `images/systems/MPDamageNumbers/${digits[i]}.png`
          : `images/systems/HPDamageNumbers/${digits[i]}.png`;
      digitImage.style.maxWidth = "60%";
      if (resistance > 1.4) {
        digitImage.style.maxWidth = "80%";
      }
      digitImage.style.height = "auto";
      digitImage.style.marginLeft = "-1.5px";
      digitImage.style.marginRight = "-1.5px";
      damageContainer.appendChild(digitImage);

      // 各数字のアニメーションを設定
      const delay = i * 30;
      setTimeout(() => {
        digitImage.style.transition = "transform 0.03s ease-in-out";
        digitImage.style.transform = "translateY(-15%)";
        setTimeout(() => {
          digitImage.style.transform = "translateY(-50%)";
          setTimeout(() => {
            digitImage.style.transform = "translateY(-15%)";
            setTimeout(() => {
              digitImage.style.transform = "translateY(0)";
            }, 30);
          }, 30);
        }, 30);
      }, delay);
    }

    // ダメージ/回復表示を消去
    setTimeout(() => {
      damageEffectContainer.remove(); // コンテナごと削除
    }, digits.length * 30 + 90 + 140);
  }
}

//////////

// 指定 milliseconds だけ処理を一時停止する関数
// global: waitMultiplierを使用
function sleep(milliseconds) {
  if (fieldState.isBattleOver || isSkipMode) {
    return Promise.resolve(); // 戦闘終了時とskipSleep設定時は即時解決
  }
  const adjustedMilliseconds = milliseconds / waitMultiplier; // グローバル変数で調整
  return new Promise((resolve) => {
    const timeoutId = setTimeout(resolve, adjustedMilliseconds);
    sleepResolvers.push({ resolve, timeoutId }); // resolve関数とtimeoutIdを保持して外部からclear可能に
  });
}

// 状況によらず指定秒数待機
function originalSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// 既存のsleep処理を中断し、fieldStateをskipMode化 (isSkipModeは実行後にfalseに戻すこと) skip解除表示に変更
// ターン開始時および戦闘再開時にsetSkipModeをfalseにする
function setSkipMode(willSkip = false) {
  if (willSkip) {
    document.getElementById("skipBtn").textContent = "skip解除";
    isSkipMode = true;
    sleepResolvers.forEach(({ resolve, timeoutId }) => {
      clearTimeout(timeoutId); // interruptSleep
      resolve(); // Promiseを解決
    });
    sleepResolvers = []; // 配列をクリア
  } else {
    document.getElementById("skipBtn").textContent = "skip";
    isSkipMode = false;
  }
}

// コマンド中または戦闘中にskip状態にする  skip状態の解除と表示戻し: せずに維持したまま次ターンコマンド画面に
document.getElementById("skipBtn").addEventListener("click", function () {
  if (document.getElementById("skipBtn").textContent === "skip解除") {
    setSkipMode(false);
  } else {
    setSkipMode(true);
  }
});

document.getElementById("resetBtn").addEventListener("click", async function () {
  document.getElementById("resetBtn").disabled = true;
  document.getElementById("skipBtn").disabled = true;
  document.getElementById("finishBtn").disabled = true;
  col("戦闘リセット");
  fieldState.isBattleOver = true;
  // 戦闘終了フラグを立て、既存のsleep処理を中断、skip状態化、skip解除表示
  setSkipMode(true);
  await originalSleep(250);
  await prepareBattle();
  // skip状態の解除と表示戻し: コマンド画面になったら
  setSkipMode(false);
  document.getElementById("resetBtn").disabled = false;
  document.getElementById("skipBtn").disabled = false;
  document.getElementById("finishBtn").disabled = false;
});

document.getElementById("finishBtn").addEventListener("click", async function () {
  //displayで全体切り替え、battle画面へ
  document.getElementById("pageHeader").style.display = "block";
  document.getElementById("adjustPartyPage").style.display = "block";
  document.getElementById("battlePage").style.display = "none";
  // 戦闘終了フラグを立て、skipしてコマンド画面に
  col("手動で戦闘終了");
  fieldState.isBattleOver = true;
  setSkipMode(true);
  stopBGM();
  // コマンドプリセットを削除
  presetCommands.length = 0;
  // buff表示loopを停止
  for (const party of parties) {
    for (const monster of party) {
      stopBuffDisplayLoop(monster);
    }
  }
  // skip状態の解除と表示戻し: 次のplayerBのパテ選択決定時に
  // 一定時間対戦開始を封じる
});

////////////////

function displayMessage(line1Text, line2Text = "", centerText = false) {
  const messageLine1 = document.getElementById("message-line1");
  const messageLine2 = document.getElementById("message-line2");
  const messageLine3 = document.getElementById("message-line3");
  const messageLine4 = document.getElementById("message-line4");
  const consoleScreen = document.getElementById("consoleScreen");
  // marginなど初期化
  messageLine1.classList.remove("skillTitle");
  messageLine1.style.marginBottom = "0";
  // 中身とサイズ・全体高さを初期化
  messageLine3.textContent = "";
  messageLine4.textContent = "";
  messageLine1.style.fontSize = "0.9rem";
  messageLine2.style.fontSize = "0.9rem";
  consoleScreen.style.height = "3.7rem";

  // 空白を挿入 全角スペース
  if (line1Text) line1Text = line1Text.replace(/ /g, "　");
  if (line2Text) line2Text = line2Text.replace(/ /g, "　");
  messageLine1.textContent = line1Text;
  messageLine2.textContent = line2Text;
  if (centerText) {
    // 第三引数がtrueの場合、中央揃えのスタイルを適用し、文字を大きくする
    consoleScreen.style.justifyContent = "center";
    messageLine1.style.textAlign = "center";
    messageLine1.style.fontSize = "1.05rem";
  } else {
    consoleScreen.style.justifyContent = "space-between";
    messageLine1.style.textAlign = "";
    messageLine1.style.fontSize = "0.9rem";
  }
}

function displayskillMessage(skillInfo, line1Text = "", line2Text = "", line3Text = "", line4Text = "") {
  const messageLine1 = document.getElementById("message-line1");
  const messageLine2 = document.getElementById("message-line2");
  const messageLine3 = document.getElementById("message-line3");
  const messageLine4 = document.getElementById("message-line4");
  const consoleScreen = document.getElementById("consoleScreen");

  // 大きさ調整とmargin直接指定で間隔をあける
  messageLine1.classList.add("skillTitle");
  messageLine1.style.marginBottom = "0.2rem";
  // 小さく
  messageLine1.style.fontSize = "0.85rem";
  messageLine2.style.fontSize = "0.7rem";
  messageLine3.style.fontSize = "0.7rem";
  messageLine4.style.fontSize = "0.7rem";

  consoleScreen.style.height = "auto";

  messageLine1.textContent = line1Text;
  messageLine2.textContent = line2Text;
  messageLine3.textContent = line3Text;
  messageLine4.textContent = line4Text;

  const img = document.createElement("img");
  img.src = getSkillTypeIcons(skillInfo);
  img.id = "skillTypeIcon";
  messageLine1.prepend(img);
}

function getSkillTypeIcons(skillInfo) {
  const skillName = skillInfo.name;
  let type;
  if (skillInfo.targetType === "dead" || skillInfo.isHealSkill) {
    type = "heal";
  } else if (skillInfo.targetTeam === "ally" && skillInfo.type !== "ritual") {
    type = "support";
  } else if (isDamageExistingSkill(skillInfo) && !skillInfo.appliedEffect && !skillInfo.act && skillInfo.howToCalculate !== "MP") {
    type = "attack";
  } else if (skillInfo.appliedEffect && skillInfo.appliedEffect !== "disruptiveWave" && skillInfo.appliedEffect !== "divineWave") {
    type = "abnormality";
  } else {
    type = "special";
  }
  // 上書きするもの
  if (["ダークミナデイン"].includes(skillName)) {
    type = "abnormality";
  }
  if (["しのルーレット"].includes(skillName)) {
    type = "special";
  }
  const src = `images/skillTypeIcons/${skillInfo.type}_${type}.png`;
  return src;
}

function isDamageExistingSkill(skillInfo) {
  if (skillInfo.howToCalculate !== "none") return true;

  let nextSkill = skillInfo.followingSkill;
  while (nextSkill) {
    const nextSkillInfo = findSkillByName(nextSkill);
    if (!nextSkillInfo) break; // スキルが見つからない場合はループを終了

    if (nextSkillInfo.howToCalculate !== "none") return true;
    nextSkill = nextSkillInfo.followingSkill;
  }

  return false;
}

function addMirrorEffect(targetImageId) {
  // 対象の画像要素を取得
  const targetImage = document.getElementById(targetImageId);

  // ミラー要素を作成
  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.top = "-15%";
  mirror.style.width = "130%";
  mirror.style.height = "130%";
  mirror.style.borderRadius = "50%";
  mirror.style.overflow = "hidden";

  // 縁の要素を作成
  const border = document.createElement("div");
  border.style.position = "absolute";
  border.style.top = "0";
  border.style.left = "0";
  border.style.width = "100%";
  border.style.height = "100%";
  border.style.borderRadius = "50%";
  border.style.border = "3px solid #fffcfb";
  border.style.boxSizing = "border-box";
  mirror.appendChild(border);

  // 内側の要素を作成
  const inner = document.createElement("div");
  inner.style.position = "absolute";
  inner.style.top = "0";
  inner.style.left = "0";
  inner.style.width = "100%";
  inner.style.height = "100%";
  inner.style.backgroundColor = "#9347d1";
  inner.style.opacity = "0.8";
  inner.style.mixBlendMode = "screen"; // 透過しながら光らせる効果
  mirror.appendChild(inner);

  // ミラー要素を画像要素の親に追加
  targetImage.parentNode.appendChild(mirror);
  // 300msかけてフェードアウト
  setTimeout(() => {
    inner.style.transition = "opacity 0.5s ease-in-out";
    inner.style.opacity = "0";
    // 縁を狭めるアニメーション
    border.style.transition = "border-width 0.5s ease-in-out"; // border-width をアニメーション
    border.style.borderWidth = "2px"; // 縁の幅を 0px に
  }, 0);

  // 完全に消えたら要素を削除
  setTimeout(() => {
    mirror.remove();
  }, 300);
}

//global: imageCache = {};を使用
async function imageExists(imageUrl) {
  // 画像のURLごとにキャッシュを保持
  if (!(imageUrl in imageCache)) {
    imageCache[imageUrl] = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = imageUrl;
    });
  }
  return await imageCache[imageUrl];
}

//global: buffDisplayTimers = {};を使用
async function updateMonsterBuffsDisplay(monster, isReversed = false) {
  // 前回のタイマーをクリア
  stopBuffDisplayLoop(monster);

  let wrapper = document.getElementById(monster.iconElementId).parentElement;
  let newId = monster.iconElementId;
  if (isReversed) {
    // monster.iconElementId を入れ替える
    newId = monster.iconElementId.includes("ally") ? monster.iconElementId.replace("ally", "enemy") : monster.iconElementId.replace("enemy", "ally");
    // wrapper を新しい要素の親要素に置き換える
    wrapper = document.getElementById(newId).parentElement;
  }

  // buffContainerを初回のみ生成
  let buffContainer = wrapper.querySelector(".buffContainer");
  if (!buffContainer) {
    buffContainer = document.createElement("div");
    buffContainer.classList.add("buffContainer");
    wrapper.appendChild(buffContainer);
  }

  // buffIconを初回のみ生成
  let buffIcons = buffContainer.querySelectorAll(".buffIcon");
  if (buffIcons.length === 0) {
    for (let i = 0; i < 3; i++) {
      const buffIcon = document.createElement("img");
      buffIcon.classList.add("buffIcon");
      buffContainer.appendChild(buffIcon);
      buffIcons = buffContainer.querySelectorAll(".buffIcon"); // 再取得
    }
  }

  // 関数実行時に一旦全て非表示化
  buffIcons.forEach((icon) => (icon.style.display = "none"));

  // isDeadの場合、すべてのbuffIconを非表示化
  if (monster.flags.isDead) {
    let iconIndex = 0;
    // 味方側の場合 棺桶、蘇生封じ の順に表示
    if (newId.includes("ally")) {
      buffIcons[iconIndex].src = "images/buffIcons/isDead.png";
      buffIcons[iconIndex].style.display = "block";
      iconIndex++;
      if (monster.buffs.reviveBlock) {
        buffIcons[iconIndex].src = monster.buffs.reviveBlock.unDispellableByRadiantWave ? "images/buffIcons/reviveBlockunDispellableByRadiantWave.png" : "images/buffIcons/reviveBlock.png";
        buffIcons[iconIndex].style.display = "block";
        iconIndex++;
      }
    }
    return;
  }

  // 亡者の場合、敵側のみすべてのbuffIconを非表示化 味方側は一部制限をして通常通り表示
  if (monster.flags.isZombie && newId.includes("enemy")) {
    return;
  }

  // 画像が存在するバフのデータのみを格納する配列
  const activeBuffs = [];
  for (const buffKey in monster.buffs) {
    // 亡者時は 亡者時付与可能バフまたは指定されたバフのみ表示 蘇生封じ ファラオなど
    const availableBuffsForZombie = ["reviveBlock", "powerCharge", "isUnbreakable", "pharaohPower", "mindBarrier"];
    if (monster.flags.isZombie && !(monster.buffs[buffKey]?.zombieBuffable || availableBuffsForZombie.includes(buffKey))) {
      continue;
    }
    // 基本のアイコンパス これを編集
    let iconSrc = `images/buffIcons/${buffKey}.png`;

    // 指定アイコン処理 (最優先)
    if (monster.buffs[buffKey]?.iconSrc) {
      iconSrc = `images/buffIcons/${monster.buffs[buffKey]?.iconSrc}.png`;
    } else if (buffKey === "slashReflection" && monster.buffs.slashReflection.isKanta) {
      // アタカン処理
      iconSrc = "images/buffIcons/atakan.png";
    } else if (buffKey === "isUnbreakable" && monster.buffs.isUnbreakable.isBroken) {
      // くじけぬ砕き処理
      iconSrc = "images/buffIcons/brokenHeart.png";
    } else if (buffKey === "countDown") {
      // カウントダウン処理
      const ifUnDispellableByRadiantWave = monster.buffs.countDown.unDispellableByRadiantWave ? "unDispellableByRadiantWave" : "";
      iconSrc = `images/buffIcons/countDown${monster.buffs.countDown.count}${ifUnDispellableByRadiantWave}.png`;
    } else {
      // 指定以外の場合、keepOnDeath, divineDispellable, unDispellableByRadiantWave, strength の順に確認
      const buffAttributes = ["keepOnDeath", "unDispellable", "divineDispellable", "unDispellableByRadiantWave", "strength"];
      for (const prop of buffAttributes) {
        if (monster.buffs[buffKey]?.[prop] !== undefined) {
          const tempSrc = `images/buffIcons/${buffKey}${prop === "strength" ? "str" + monster.buffs[buffKey][prop] : prop}.png`;
          if (await imageExists(tempSrc)) {
            // 対応するアイコンが存在すればパスを更新して離脱
            iconSrc = tempSrc;
            break;
          }
        }
      }
    }

    // 画像が存在する場合は、activeBuffsにバフデータを追加
    if (await imageExists(iconSrc)) {
      activeBuffs.push({ key: buffKey, src: iconSrc });
    }
  }

  // みがわりアイコンをpush
  if (monster.flags.hasSubstitute) {
    activeBuffs.push({ key: "hasSubstitute", src: "images/buffIcons/hasSubstitute.png" });
  }
  if (monster.flags.isSubstituting) {
    activeBuffs.push({ key: "isSubstituting", src: "images/buffIcons/isSubstituting.png" });
  }
  // 天の竜気アイコンをpush
  if (monster.buffs.dragonPreemptiveAction) {
    activeBuffs.push({ key: "dragonPreemptiveAction", src: `images/buffIcons/dragonPreemptiveAction${monster.buffs.dragonPreemptiveAction.strength}.png` });
  }
  // 石化封じアイコンをpush
  if (fieldState.stonedBlock) {
    activeBuffs.push({ key: "stonedBlock", src: "images/buffIcons/stonedBlock.png" });
  }
  // 亡者アイコンを先頭に挿入
  if (monster.flags.isZombie) {
    activeBuffs.unshift({ key: "isZombie", src: "images/buffIcons/isZombie.png" });
  }

  if (activeBuffs.length === 0) {
    // バフがない場合は、すべてのbuffIconを非表示にする
    buffIcons.forEach((icon) => (icon.style.display = "none"));
    return;
  }

  let buffIndex = 0;

  function showNextBuffs() {
    buffIcons.forEach((icon) => (icon.style.display = "none"));

    const startIndex = buffIndex * 3;
    const buffsToShow = activeBuffs.slice(startIndex, startIndex + 3);

    buffsToShow.forEach((buff, index) => {
      const buffIcon = buffIcons[index];
      buffIcon.src = buff.src;
      const buffsmaller = adjustBuffSize(buff.src);
      buffIcon.style.scale = buffsmaller ? "0.93" : "1";
      buffIcon.style.display = "block"; // 表示する
    });

    buffIndex = (buffIndex + 1) % Math.ceil(activeBuffs.length / 3);

    if (activeBuffs.length > 3) {
      // タイマーを設定する前に、既存のタイマーをクリア
      if (buffDisplayTimers[monster.monsterId]) {
        clearTimeout(buffDisplayTimers[monster.monsterId]);
      }
      buffDisplayTimers[monster.monsterId] = setTimeout(showNextBuffs, 600);
    }
  }

  showNextBuffs();
}

function adjustBuffSize(buffSrc) {
  const smallBuffSrcList = [
    "images/buffIcons/breathBarrierstr2.png",
    "images/buffIcons/breathBarrierstr-1.png",
    "images/buffIcons/breathBarrierstr-2.png",
    "images/buffIcons/iceResistancestr-3.png",
    "images/buffIcons/tyoryuLevelstr3.png",
    "images/buffIcons/tyoryuLevelstr2.png",
    "images/buffIcons/iceResistancestr-2.png",
    "images/buffIcons/windResistancestr-2.png",
    "images/buffIcons/windResistancestr-3.png",
    "images/buffIcons/iceResistancestr-1.png",
    "images/buffIcons/windResistancestr-1.png",
    "images/buffIcons/lightResistancestr-3.png",
    "images/buffIcons/lightResistancestr-2.png",
    "images/buffIcons/darkResistancestr-3.png",
    "images/buffIcons/lightResistancestr-1.png",
    "images/buffIcons/thunderResistancestr-3.png",
    "images/buffIcons/thunderResistancestr-2.png",
    "images/buffIcons/darkResistancestr-1.png",
    "images/buffIcons/fireResistancestr-3.png",
    "images/buffIcons/thunderResistancestr-1.png",
    "images/buffIcons/spdUpkeepOnDeathstr2.png",
    "images/buffIcons/intUpstr-2.png",
    "images/buffIcons/powerWeaken.png",
    "images/buffIcons/fireBreakBoost.png",
    "images/buffIcons/tyoryuLevelstr1.png",
    "images/buffIcons/dragonPreemptiveAction6.png",
    "images/buffIcons/dragonPreemptiveAction8.png",
    "images/buffIcons/pharaohPower.png",
    "images/buffIcons/dragonPreemptiveAction9.png",
    "images/buffIcons/dragonPreemptiveAction7.png",
    "images/buffIcons/intUpstr-1.png",
    "images/buffIcons/defUpstr-1.png",
    "images/buffIcons/paralyzedBreakstr2.png",
    "images/buffIcons/masostr5.png",
    "images/buffIcons/spdUpstr-2.png",
    "images/buffIcons/baikistr-1.png",
    "images/buffIcons/baikistr-2.png",
    "images/buffIcons/iburuSpdUp.png",
    "images/buffIcons/masostr3.png",
    "images/buffIcons/masostr2.png",
    "images/buffIcons/masostr4.png",
    "images/buffIcons/masostr1.png",
    "images/buffIcons/poisonedunDispellableByRadiantWave.png",
    "images/buffIcons/spellSeal.png",
    "images/buffIcons/allElementalBarrierstr0.5.png",
    "images/buffIcons/martialSeal.png",
    "images/buffIcons/murakumo.png",
    "images/buffIcons/healBlockkeepOnDeath.png",
    "images/buffIcons/darkBuffstr0.6.png",
    "images/buffIcons/darkBuffstr0.4.png",
    "images/buffIcons/darkBuffstr0.2.png",
    "images/buffIcons/protectiondivineDispellablestr0.4.png",
    "images/buffIcons/protectiondivineDispellablestr0.34.png",
    "images/buffIcons/aiPursuitCommand.png",
    "images/buffIcons/abanPreemptive.png",
    "images/buffIcons/prismVeilstr1.png",
    "images/buffIcons/dotMPdamage.png",
    "images/buffIcons/MPabsorption.png",
  ];
  if (smallBuffSrcList.includes(buffSrc)) {
    return true;
  } else {
    return false;
  }
}

function stopBuffDisplayLoop(monster) {
  if (buffDisplayTimers[monster.monsterId]) {
    clearTimeout(buffDisplayTimers[monster.monsterId]);
    buffDisplayTimers[monster.monsterId] = null;
  }
}

//光の波動 dispellableByRadiantWave指定以外を残す
async function executeRadiantWave(monster, skipMissDisplay = false, removeMaso = false) {
  const newBuffs = {};
  let debuffRemoved = false; // バフが削除されたかどうかを追跡するフラグ
  for (const key in monster.buffs) {
    const value = monster.buffs[key];
    if (value.dispellableByRadiantWave) {
      debuffRemoved = true; // 削除フラグ
    } else {
      newBuffs[key] = value;
    }
  }
  monster.buffs = newBuffs;
  if (removeMaso && monster.buffs.maso && monster.buffs.maso.strength !== 5) {
    delete monster.buffs.maso;
    debuffRemoved = true;
  }
  // ひれつ強制みがわり中の場合、みがわりを解除
  if (monster.flags.isSubstituting && monster.flags.isSubstituting.isBoogie) {
    deleteSubstitute(monster);
  }

  if (!debuffRemoved && !skipMissDisplay) {
    displayMiss(monster);
  }
  updateCurrentStatus(monster);
  await updateMonsterBuffsDisplay(monster);
}

//keepOnDeath・状態異常フラグ2種・かみは解除不可・(かみは限定解除)は解除しない  別途指定: 非keepOnDeathバフ 力ため 行動早い 無属性無効 会心完全ガード //これは石化でのkeep処理と共通
async function executeWave(monster, isDivine = false, isDamageExisting = false) {
  const keepKeys = ["powerCharge", "manaBoost", "breathCharge", "statusLock", "preemptiveAction", "anchorAction", "nonElementalResistance"];
  const newBuffs = {};
  let buffRemoved = false; // バフが削除されたかどうかを追跡するフラグ
  for (const key in monster.buffs) {
    const value = monster.buffs[key];
    // keepOnDeathでも削除するバフ群 竜王杖や極天地のようなunDispellable指定以外は削除
    const deleteKeys = ["counterAttack", "revive", "tabooSeal", "angelMark"];
    if (deleteKeys.includes(key) && !value.unDispellable && (!value.divineDispellable || isDivine)) {
      buffRemoved = true; // バフが削除されたことを記録
      continue;
    }

    if (keepKeys.includes(key) || value.keepOnDeath || value.unDispellable || value.dispellableByRadiantWave || value.unDispellableByRadiantWave || (!isDivine && value.divineDispellable)) {
      newBuffs[key] = value;
    } else {
      buffRemoved = true; //上記の条件に当てはまらない場合も削除扱い
    }
  }
  monster.buffs = newBuffs;

  if (!buffRemoved && !isDamageExisting) {
    displayMiss(monster); // バフが削除されなかった場合にdisplayMiss関数を呼び出す
  }
  updateCurrentStatus(monster);
  await updateMonsterBuffsDisplay(monster);
}

// みがわり系の処理
function applySubstitute(skillUser, skillTarget, isAll = false, isCover = false, isBoogie = false) {
  // 自分がみがわりや仁王・覆う中は発動しない isAllの場合for文内の途中でisSubstitutingが付与されるので、あらかじめここで弾く
  // 仁王立ち後のみがわりは使用者targetともに外れてないとreturn 覆う中の仁王は覆う・覆われ以外に対して仁王付与
  if (skillUser.flags.isSubstituting || skillUser.flags.hasSubstitute) {
    return;
  }
  if (isAll) {
    for (const target of parties[skillUser.teamID]) {
      processSubstitute(skillUser, target, isAll, isCover, isBoogie);
    }
  } else {
    processSubstitute(skillUser, skillTarget, isAll, isCover, isBoogie);
  }
}

// みがわり系の付与
function processSubstitute(skillUser, skillTarget, isAll, isCover, isBoogie) {
  // processを経ていないので石化判定なども実行
  if (
    skillTarget.flags.isDead ||
    skillTarget.flags.isZombie ||
    skillUser.flags.isDead ||
    skillUser.flags.isZombie ||
    skillUser.monsterId == skillTarget.monsterId //自分自身は仁王立ちの対象にしない
  ) {
    return;
  }
  if (skillTarget.buffs.stoned || skillTarget.flags.thisTurn.substituteSeal || skillUser.flags.thisTurn.substituteSeal || skillTarget.flags.isSubstituting || skillTarget.flags.hasSubstitute) {
    displayMiss(skillTarget);
    return;
  }
  // みがわり仁王成功時
  skillTarget.flags.hasSubstitute = {};
  skillTarget.flags.hasSubstitute.targetMonsterId = skillUser.monsterId;
  // 初回のみ生成
  if (!skillUser.flags.hasOwnProperty("isSubstituting")) {
    skillUser.flags.isSubstituting = {};
    skillUser.flags.isSubstituting.targetMonsterId = [];
  }
  // みがわり先をpush
  skillUser.flags.isSubstituting.targetMonsterId.push(skillTarget.monsterId);
  // 覆う
  if (isCover) {
    skillTarget.flags.hasSubstitute.cover = true;
    skillUser.flags.isSubstituting.cover = true;
  }
  // ブギーフラグ(光の波動解除可能)
  if (isBoogie) {
    skillUser.flags.isSubstituting.isBoogie = true;
    updateMonsterBuffsDisplay(skillTarget); // ブギーも必要
  }
  if (isAll) {
    displayMessage("モンスターたちは", "敵の行動をうけなくなった！");
    updateMonsterBuffsDisplay(skillTarget); // isallのときだけfieldなので必要
  } else {
    displayMessage(`${skillTarget.name}は`, "敵の行動をうけなくなった！");
  }
}

function preloadImages() {
  const imageUrls = [
    "images/systems/miss.png",
    "images/systems/effectImages/allyDamaged.png",
    "images/systems/effectImages/allyDamagedCritical.png",
    "images/systems/effectImages/allyDamagedSuperWeakness.png",
    "images/systems/effectImages/allyDamagedUltraWeakness.png",
    "images/systems/effectImages/allyDamagedWeakness.png",
    "images/systems/effectImages/enemyDamaged.png",
    "images/systems/effectImages/enemyDamagedCritical.png",
    "images/systems/effectImages/enemyDamagedSuperWeakness.png",
    "images/systems/effectImages/enemyDamagedUltraWeakness.png",
    "images/systems/effectImages/enemyDamagedWeakness.png",
    "images/systems/effectImages/HPRecovery.png",
    "images/systems/effectImages/MPRecovery.png",
    "images/systems/HPDamageNumbers/0.png",
    "images/systems/HPDamageNumbers/1.png",
    "images/systems/HPDamageNumbers/2.png",
    "images/systems/HPDamageNumbers/3.png",
    "images/systems/HPDamageNumbers/4.png",
    "images/systems/HPDamageNumbers/5.png",
    "images/systems/HPDamageNumbers/6.png",
    "images/systems/HPDamageNumbers/7.png",
    "images/systems/HPDamageNumbers/8.png",
    "images/systems/HPDamageNumbers/9.png",
    "images/systems/HPRecoveryNumbers/0.png",
    "images/systems/HPRecoveryNumbers/1.png",
    "images/systems/HPRecoveryNumbers/2.png",
    "images/systems/HPRecoveryNumbers/3.png",
    "images/systems/HPRecoveryNumbers/4.png",
    "images/systems/HPRecoveryNumbers/5.png",
    "images/systems/HPRecoveryNumbers/6.png",
    "images/systems/HPRecoveryNumbers/7.png",
    "images/systems/HPRecoveryNumbers/8.png",
    "images/systems/HPRecoveryNumbers/9.png",
    "images/systems/MPRecoveryNumbers/0.png",
    "images/systems/MPRecoveryNumbers/1.png",
    "images/systems/MPRecoveryNumbers/2.png",
    "images/systems/MPRecoveryNumbers/3.png",
    "images/systems/MPRecoveryNumbers/4.png",
    "images/systems/MPRecoveryNumbers/5.png",
    "images/systems/MPRecoveryNumbers/6.png",
    "images/systems/MPRecoveryNumbers/7.png",
    "images/systems/MPRecoveryNumbers/8.png",
    "images/systems/MPRecoveryNumbers/9.png",

    "images/skillTypeIcons/breath_abnormality.png",
    "images/skillTypeIcons/breath_attack.png",
    "images/skillTypeIcons/breath_special.png",
    "images/skillTypeIcons/dance_abnormality.png",
    "images/skillTypeIcons/dance_attack.png",
    "images/skillTypeIcons/dance_heal.png",
    "images/skillTypeIcons/dance_special.png",
    "images/skillTypeIcons/dance_support.png",
    "images/skillTypeIcons/martial_abnormality.png",
    "images/skillTypeIcons/martial_attack.png",
    "images/skillTypeIcons/martial_heal.png",
    "images/skillTypeIcons/martial_special.png",
    "images/skillTypeIcons/martial_support.png",
    "images/skillTypeIcons/ritual_abnormality.png",
    "images/skillTypeIcons/ritual_attack.png",
    "images/skillTypeIcons/ritual_heal.png",
    "images/skillTypeIcons/ritual_special.png",
    "images/skillTypeIcons/slash_abnormality.png",
    "images/skillTypeIcons/slash_attack.png",
    "images/skillTypeIcons/slash_special.png",
    "images/skillTypeIcons/spell_abnormality.png",
    "images/skillTypeIcons/spell_attack.png",
    "images/skillTypeIcons/spell_heal.png",
    "images/skillTypeIcons/spell_special.png",
    "images/skillTypeIcons/spell_support.png",
  ];
  imageUrls.forEach((imageUrl) => {
    const img = new Image();
    img.src = imageUrl;
  });
}

// MPcostを返す スキル選択時と実行時
function calculateMPcost(skillUser, executingSkill) {
  if (executingSkill.MPcostRatio) {
    return Math.floor(skillUser.currentStatus.MP * executingSkill.MPcostRatio); // 現在MPに対する割合 切り捨て
  }
  let calcMPcost = executingSkill.MPcost;
  //メタル
  if (skillUser.buffs.mpCostMultiplier) {
    calcMPcost = Math.ceil(calcMPcost * skillUser.buffs.mpCostMultiplier.strength);
  }
  //超伝説
  if (skillUser.race.includes("超伝説") && !skillUser.buffs.tagTransformation) {
    calcMPcost = Math.ceil(calcMPcost * 1.2);
  }
  //コツの半減 todo: メゾラにギラコツのMP半減乗ってない
  if (
    (skillUser.buffs.breathEnhancement && executingSkill.type === "breath") ||
    (skillUser.buffs.elementEnhancement && executingSkill.type === "spell" && skillUser.buffs.elementEnhancement.element === executingSkill.element) ||
    (skillUser.buffs.healEnhancement && (executingSkill.targetType === "dead" || executingSkill.isHealSkill))
  ) {
    calcMPcost = Math.floor(calcMPcost * 0.5);
  }
  return calcMPcost;
}

function hasEnoughMpForSkill(skillUser, executingSkill) {
  const mpCost = calculateMPcost(skillUser, executingSkill);
  if (skillUser.currentStatus.MP >= mpCost && !(executingSkill.MPcostRatio && skillUser.currentStatus.MP === 0)) {
    return true;
  } else {
    return false;
  }
}

function displayBuffMessage(buffTarget, buffName, buffData) {
  // バフメッセージ定義
  const buffMessages = {
    fireBreak: {
      start: `${buffTarget.name}は メラ耐性を`,
      message: `${buffData.strength}ランク下げて 攻撃する状態になった！`,
    },
    allElementalBreak: {
      start: `${buffTarget.name}は 属性耐性を`,
      message: `${buffData.strength}ランク下げて 攻撃する状態になった！`,
    },
    fireGuard: {
      start: `${buffTarget.name}は`,
      message: `メラ系の受けるダメージが減った！`,
    },
    powerCharge: {
      start: `${buffTarget.name}は`,
      message: "ちからをためている！",
    },
    manaBoost: {
      start: `${buffTarget.name}は`,
      message: "魔力をためている！",
    },
    breathCharge: {
      start: `${buffTarget.name}は`,
      message: `息ダメージが${buffData.strength}倍になった！`,
    },
    preemptiveAction: {
      start: `${buffTarget.name}の`,
      message: "こうどうが はやくなった！",
    },
    anchorAction: {
      start: `${buffTarget.name}の`,
      message: "こうどうが おそくなった！",
    },
    nonElementalResistance: {
      start: `${buffTarget.name}は`,
      message: "無属性攻撃を受けなくなった！",
    },
    damageLimit: {
      start: `${buffTarget.name}は`,
      message: `被ダメージ上限値${buffData.strength}の状態になった！`,
    },
    spellSeal: {
      start: `${buffTarget.name}は`,
      message: "呪文を ふうじられた！",
    },
    breathSeal: {
      start: `${buffTarget.name}は`,
      message: "息を ふうじられた！",
    },
    slashSeal: {
      start: `${buffTarget.name}は`,
      message: "斬撃を ふうじられた！",
    },
    martialSeal: {
      start: `${buffTarget.name}は`,
      message: "体技を ふうじられた！",
    },
    fear: {
      start: `${buffTarget.name}は`,
      message: "動きを ふうじられた！",
    },
    tempted: {
      start: `${buffTarget.name}の`,
      message: "防御力がさがり 動けなくなった！",
    },
    sealed: {
      start: `${buffTarget.name}は`,
      message: "動きを ふうじられた！",
    },
    confused: {
      start: `${buffTarget.name}の`,
      message: "あたまは こんらんした！",
    },
    paralyzed: {
      start: `${buffTarget.name}は`,
      message: "しびれて動けなくなった！",
    },
    asleep: {
      start: `${buffTarget.name}は`,
      message: "ふかい ねむりにおちた！",
    },
    stoned: {
      start: `${buffTarget.name}の身体が`,
      message: "金のかたまりになった！",
    },
    poisoned: {
      start: `${buffTarget.name}は`,
      message: "どくにおかされた！",
    },
    dazzle: {
      start: `${buffTarget.name}は`,
      message: "まぼろしに つつまれた！",
    },
    reviveBlock: {
      start: `${buffTarget.name}は`,
      message: "蘇生を ふうじられた！",
    },
    healBlock: {
      start: `${buffTarget.name}は`,
      message: "HPとMPが回復しなくなった！",
    },
    MPabsorption: {
      start: `${buffTarget.name}は`,
      message: "MPを 吸収されるようになった！",
    },
    countDown: {
      start: "死のカウントダウンが",
      message: "はじまった！",
    },
    maso: {
      start: `${buffTarget.name}は`,
      message: "マ素深度があがった！",
    },
    elementalRetributionMark: {
      start: `${buffTarget.name}は`,
      message: "刻印状態になった！",
    },
    demonKingBarrier: {
      start: `${buffTarget.name}は`,
      message: "あらゆる状態異常が効かなくなった！",
    },
    mindBarrier: {
      start: "行動停止系の効果が 効かなくなった！",
      message: "",
    },
    sleepBarrier: {
      start: `${buffTarget.name}は`,
      message: "ねむりの効果が 効かなくなった！",
    },
    confusionBarrier: {
      start: `${buffTarget.name}は`,
      message: "こんらんの効果が 効かなくなった！",
    },
    paralyzeBarrier: {
      start: `${buffTarget.name}は`,
      message: "マヒの効果が 効かなくなった！",
    },
    protection: {
      start: `${buffTarget.name}の`,
      message: "受けるダメージが減少した！",
    },
    dodgeBuff: {
      start: `${buffTarget.name}の`,
      message: "回避率が あがった！",
    },
    continuousHealing: {
      start: `${buffTarget.name}は`,
      message: "HPが 回復する状態になった！",
    },
    revive: {
      start: `${buffTarget.name}は`,
      message: "自動で復活する状態になった！",
    },
    controlOfRapu: {
      start: `${buffTarget.name}は`,
      message: "暗黒神の支配状態になった",
    },
    spellEvasion: {
      start: `${buffTarget.name}は`,
      message: "呪文攻撃を うけなくなった！",
    },
    slashEvasion: {
      start: `${buffTarget.name}は`,
      message: "斬撃攻撃を うけなくなった！",
    },
    martialEvasion: {
      start: `${buffTarget.name}は`,
      message: "体技攻撃を うけなくなった！",
    },
    breathEvasion: {
      start: `${buffTarget.name}は`,
      message: "息攻撃を うけなくなった！",
    },
    internalAtkUp: {
      start: `${buffTarget.name}の`,
      message: `攻撃力が ${buffData.strength + 1}倍になった！`,
    },
    internalDefUp: {
      start: `${buffTarget.name}の`,
      message: `防御力が ${buffData.strength + 1}倍になった！`,
    },
    internalIntUp: {
      start: `${buffTarget.name}の`,
      message: `賢さが ${buffData.strength + 1}倍になった！`,
    },
    iceDomain: {
      start: `${buffTarget.name}の`,
      message: "ヒャド系のダメージが あがった！",
    },
    thunderDomain: {
      start: `${buffTarget.name}の`,
      message: "ギラ系のダメージが あがった！",
    },
    darkDomain: {
      start: `${buffTarget.name}の`,
      message: "ドルマ系のダメージが あがった！",
    },
    fireDomain: {
      start: `${buffTarget.name}の`,
      message: "メラ系のダメージが あがった！",
    },
    goddessDefUp: {
      start: `${buffTarget.name}の`,
      message: "防御力が あがった！",
    },
    castleDefUp: {
      start: `${buffTarget.name}の`,
      message: "防御力が あがった！",
    },
    speedBasedAttack: {
      start: `${buffTarget.name}は`,
      message: "通常攻撃が 素早さ依存になった！",
    },
    kiganLevel: {
      start: `${buffTarget.name}は`,
      message: "鬼眼レベルが あがった！",
    },
    worldBuff: {
      start: `${buffTarget.name}の`,
      message: "与えるダメージが 上がった！",
    },
    aiPursuitCommand: {
      start: `${buffTarget.name}は 次の`,
      message: "AI行動で とくぎを使うようになった！",
    },
    counterAttack: {
      start: `${buffTarget.name}は`,
      message: "攻撃に対して 反撃する状態になった！",
    },
    aiExtraAttacks: {
      start: `${buffTarget.name}は`,
      message: "AI行動の回数が ふえた！",
    },
    prismVeil: {
      start: `${buffTarget.name}の`,
      message: "全属性耐性が あがった！",
    },
  };

  const stackableBuffs = {
    baiki: "攻撃力",
    defUp: "防御力",
    spdUp: "素早さ",
    intUp: "賢さ",
    spellBarrier: "呪文に対する防御力",
    slashBarrier: "斬撃に対する防御力",
    martialBarrier: "体技に対する防御力",
    breathBarrier: "息に対する防御力",
    fireResistance: "メラ耐性",
    iceResistance: "ヒャド耐性",
    thunderResistance: "ギラ耐性",
    windResistance: "バギ耐性",
    ioResistance: "イオ耐性",
    lightResistance: "デイン耐性",
    darkResistance: "ドルマ耐性",
    zakiResistance: "ザキ耐性",
  };

  const breakBoosts = ["fireBreakBoost", "iceBreakBoost", "thunderBreakBoost", "windBreakBoost", "ioBreakBoost", "lightBreakBoost", "darkBreakBoost"];

  //dazzle, dotDamage, healBlock

  if (buffMessages[buffName]) {
    if (buffName === "dodgeBuff" && buffData.strength === 1) {
      displayMessage(`${buffTarget.name}の`, "回避率が最大になった！");
    } else if (buffName === "stoned" && buffTarget.commandInput === "アストロンゼロ") {
      displayMessage(`${buffTarget.name}は`, "敵の攻撃をうけなくなった！");
    } else if (buffName === "stoned" && !buffData.isGolden) {
      displayMessage("モンスターたちは", "敵の攻撃をうけなくなった！");
    } else {
      displayMessage(buffMessages[buffName].start, buffMessages[buffName].message);
    }
  } else if (stackableBuffs.hasOwnProperty(buffName)) {
    if (buffData.strength < 0) {
      displayMessage(`${buffTarget.name}の`, `${stackableBuffs[buffName]}が さがった！！`);
    } else {
      displayMessage(`${buffTarget.name}の`, `${stackableBuffs[buffName]}が あがった！！`);
    }
  } else if (breakBoosts.includes(buffName)) {
    displayMessage(`${buffTarget.name}の`, "ブレイク状態が強化された！");
  }
}

// 引数名はnot skillUser
async function transformTyoma(monster) {
  // 冗長性
  if (monster.flags.isDead || monster.flags.hasTransformed) {
    return;
  }
  await sleep(200);
  monster.iconSrc = "images/icons/" + monster.id + "Transformed.jpeg";
  updateBattleIcons(monster);
  // 複数回変身に注意
  monster.flags.hasTransformed = true;
  delete monster.buffs.sealed; // 封印は共通で解除
  await executeRadiantWave(monster);

  // skill変更と 各種message
  if (monster.name === "憎悪のエルギオス") {
    monster.skill[0] = "絶望の天舞";
    delete monster.buffs.stoned;
    displayMessage("＊「憎悪のはげしさを…… 絶望の深さを…", "  今こそ 思いしらせてくれるわッ！！");
  } else if (monster.name === "死を統べる者ネルゲル") {
    monster.attribute.additionalPermanentBuffs.spellBarrier = { unDispellable: true, strength: 2, duration: 0 };
    monster.attribute.additionalPermanentBuffs.breathBarrier = { unDispellable: true, strength: 2, duration: 0 };
    monster.skill[0] = "終の流星";
    monster.skill[1] = "暴獣の右ウデ";
    displayMessage("＊「……大いなる闇の根源よ。", "  我にチカラを 与えたまえ！");
    await sleep(200);
    displayMessage("＊「見よっ この強靱なる肉体をぉ！", "  この絶大なる魔力をぉ！");
  } else if (monster.name === "魔扉の災禍オムド・レクス") {
    monster.skill[0] = "クロノストーム";
    monster.skill[2] = "永劫の闇冥";
    displayMessage("＊「くだらぬ希望など", "  すべて消し去ってやろう。");
  } else if (monster.name === "新たなる神ラプソーン") {
    monster.buffs.ioBreak.strength = 3;
    monster.skill[0] = "真・神々の怒り";
    monster.skill[1] = "爆炎の儀式";
    displayMessage("＊「死してなお消えぬほどの 永遠の恐怖を", "  その魂に 焼きつけてくれるわっ！！");
  } else if (monster.name === "万物の王オルゴ・デミーラ") {
    monster.skill[0] = "リーサルエッジ";
    monster.skill[1] = "火艶乱拳";
    monster.flags.zombieProbability = 1;
    monster.flags.isUnAscensionable = true;
    monster.flags.zombifyActName = "不滅の美";
    monster.flags.reviveNextTurn = "怨嗟のうめき";
    displayMessage("＊「オホホホ。", "  おバカさんにも ほどがあるわね。");
  } else if (monster.name === "名もなき闇の王") {
    monster.skill[2] = "名もなき儀式";
    displayMessage("＊「我に 恐怖に歪む顔を 見せよ…。");
  } else if (monster.name === "闇の覇者りゅうおう") {
    displayMessage(`${monster.name}の姿が しだいに`, "うすれてゆく……。");
    await sleep(150);
    displayMessage(`${monster.name}が しょうたいを`, "あらわした！！");
    monster.skill[0] = {
      1: "竜の炎",
      2: "破滅の炎",
      3: "終焉の炎",
    }[monster.buffs.tyoryuLevel.strength];
    monster.skill[1] = {
      1: "竜牙",
      2: "王の竜牙",
      3: "覇者の竜牙",
    }[monster.buffs.tyoryuLevel.strength];
  } else if (monster.name === "魔界の神バーン") {
    displayMessage("＊「今ここに！！！", "  魔の時代来たる！！！！");
    await sleep(150);
    displayMessage("＊「さあッ！！！", "  刮目せよっ！！！！");
    monster.skill[0] = "極・天地魔闘の構え";
    monster.skill[1] = "真・カラミティエンド";
    monster.attribute.additionalPermanentBuffs.slashBarrier = { unDispellable: true, strength: 2, duration: 0 };
    monster.attribute.additionalPermanentBuffs.martialBarrier = { unDispellable: true, strength: 2, duration: 0 };
    // アタカン削除
    if (monster.buffs.slashReflection && monster.buffs.slashReflection.name === "光魔の杖") {
      delete monster.buffs.slashReflection;
    }
    // 魔力覚醒力ため削除
    if (monster.buffs.manaBoost && monster.buffs.manaBoost.name === "光魔の杖") {
      delete monster.buffs.manaBoost;
    }
    if (monster.buffs.powerCharge && monster.buffs.powerCharge.name === "光魔の杖") {
      delete monster.buffs.powerCharge;
    }
  } else if (monster.name === "剣神ピサロ") {
    monster.skill[0] = "憤怒の雷";
    monster.skill[1] = "ねだやしの業火";
    applyBuff(monster, { thunderBreak: { keepOnDeath: true, strength: 2 } });
    displayMessage("＊「ぐはあああ……！", "  ねだやしにしてくれるわっ！");
  }
  await sleep(400);

  // 共通バフ
  applyBuff(monster, { demonKingBarrier: { divineDispellable: true } });
  await sleep(150);
  applyBuff(monster, { nonElementalResistance: {} });
  await sleep(150);
  if (monster.name !== "名もなき闇の王") {
    applyBuff(monster, { protection: { divineDispellable: true, strength: 0.5, duration: 3 } });
    await sleep(150);
  }

  // 各種buff
  if (monster.name === "憎悪のエルギオス") {
    applyBuff(monster, { dodgeBuff: { strength: 1, keepOnDeath: true } });
    monster.abilities.attackAbilities.nextTurnAbilities.push({
      act: async function (skillUser) {
        await executeSkill(skillUser, findSkillByName("堕天使の理"), null, false, null, false, true, null);
      },
    });
  } else if (monster.name === "死を統べる者ネルゲル") {
    applyBuff(monster, { internalDefUp: { keepOnDeath: true, strength: 0.5 } });
  } else if (monster.name === "名もなき闇の王") {
    monster.buffs.darkBreak.strength = 4;
    applyBuff(monster, { internalDefUp: { keepOnDeath: true, strength: 1 } });
    applyBuff(monster, { isUnbreakable: { keepOnDeath: true, left: 3, name: "ラストスタンド" } });
  } else if (monster.name === "闇の覇者りゅうおう") {
    applyBuff(monster, { fireBreak: { strength: 3, keepOnDeath: true, iconSrc: "fireBreakBoost" } });
    if (monster.gear?.name === "闇の覇者ハート") {
      applyBuff(monster, { internalDefUp: { keepOnDeath: true, strength: 1 } });
      await sleep(100);
    }
    if (monster.buffs.tyoryuLevel.strength > 1) {
      applyBuff(monster, { metal: { keepOnDeath: true, strength: 0.66 }, spdUp: { strength: 2, keepOnDeath: true, iconSrc: "spdUpkeepOnDeathstr2" } });
    }
    applyBuff(monster, { isUnbreakable: { keepOnDeath: true, left: 3, name: "ラストスタンド" } });
    delete monster.buffs.tyoryuLevel.unDispellable;
    monster.buffs.tyoryuLevel.keepOnDeath = true;
  }

  // 回復
  if (monster.name !== "死を統べる者ネルゲル") {
    //ネルのみHP回復を実行しない
    await sleep(400);
    applyDamage(monster, monster.defaultStatus.HP, -1);
  }
  await sleep(500);
  applyDamage(monster, monster.defaultStatus.MP, -1, true); //MP

  // 回復後発動する変身時特性など
  if (monster.name === "憎悪のエルギオス") {
    await sleep(400);
    for (const target of parties[monster.enemyTeamID]) {
      if (!target.buffs.angelMark) {
        applyBuff(target, { healBlock: {} });
      }
    }
  } else if (monster.name === "魔扉の災禍オムド・レクス") {
    await sleep(400);
    displayMessage(`${monster.name}の特性`, "歪みの根源 が発動！");
    if (!fieldState.psychoField) {
      fieldState.isDistorted = true;
      fieldState.isPermanentDistorted = true;
      await deleteElementalBuffs();
      adjustFieldStateDisplay();
    }
  } else if (monster.name === "新たなる神ラプソーン") {
    await sleep(400);
    displayMessage("無属性とくぎを防ぐ状態が", "解除された！");
    for (const party of parties) {
      for (const tempTarget of party) {
        let skillTarget = tempTarget;
        if (skillTarget.flags.hasSubstitute) {
          skillTarget = parties.flat().find((monster) => monster.monsterId === skillTarget.flags.hasSubstitute.targetMonsterId);
        }
        if (skillTarget.buffs.nonElementalResistance && skillTarget.name !== "新たなる神ラプソーン") {
          delete skillTarget.buffs.nonElementalResistance;
          await updateMonsterBuffsDisplay(skillTarget);
        }
      }
    }
  } else if (monster.name === "闇の覇者りゅうおう") {
    await sleep(400);
    displayMessage(`${monster.name}の特性`, "闇の世界 が発動！");
    for (const target of parties[monster.enemyTeamID]) {
      applyBuff(target, { dazzle: { probability: 1 } });
    }
    delete fieldState.isReverse;
    delete fieldState.isPermanentReverse;
    if (!fieldState.psychoField) {
      fieldState.disableReverse = 6;
    }
    adjustFieldStateDisplay();
  }
  await sleep(400);
}

function deleteSubstitute(target) {
  if (target.flags.isSubstituting) {
    // targetがみがわり中の場合 targetがみがわっている相手(hasSubstituteのtargetが死亡者と一致)からみがわり所持を削除 その後targetのみがわり中も削除
    for (const monster of parties.flat()) {
      if (monster.flags.hasSubstitute && monster.flags.hasSubstitute.targetMonsterId === target.monsterId) {
        delete monster.flags.hasSubstitute;
        updateMonsterBuffsDisplay(monster);
      }
    }
    delete target.flags.isSubstituting;
    updateMonsterBuffsDisplay(target);
  }
  if (target.flags.hasSubstitute) {
    // targetがみがわられ中の場合 みがわり中の相手のみがわり先一覧からtargetを削除 もし空になったら完全削除 その後targetのみがわられ中を削除
    const substitutingMonster = parties.flat().find((monster) => monster.monsterId === target.flags.hasSubstitute.targetMonsterId);
    if (substitutingMonster) {
      // その要素のflags.isSubstituting.targetMonsterIdの配列内から、target.monsterIdと等しい文字列を削除する。
      substitutingMonster.flags.isSubstituting.targetMonsterId = substitutingMonster.flags.isSubstituting.targetMonsterId.filter((id) => id !== target.monsterId);
      //空になったら削除・みがわり表示更新
      if (substitutingMonster.flags.isSubstituting.targetMonsterId.length === 0) {
        delete substitutingMonster.flags.isSubstituting;
        updateMonsterBuffsDisplay(substitutingMonster);
      }
    }
    delete target.flags.hasSubstitute;
    updateMonsterBuffsDisplay(target);
  }
}

function getNormalAttackName(skillUser) {
  let NormalAttackName = "通常攻撃";
  //上から優先的に処理して当てはまったらその時点で確定
  if (skillUser.gear?.name === "心砕きのヤリ") {
    NormalAttackName = "心砕き攻撃";
  } else if (skillUser.gear?.name === "昇天のヤリ") {
    NormalAttackName = "昇天槍攻撃";
  } else if (skillUser.gear?.name === "系統爪ザキ" || skillUser.gear?.name === "系統爪ザキ&防御力20%") {
    NormalAttackName = "通常攻撃ザキ攻撃";
  } else if (skillUser.gear?.name === "キラーピアス" || skillUser.gear?.name === "源氏の小手") {
    NormalAttackName = "はやぶさ攻撃弱";
  } else if (skillUser.gear?.name === "おうごんのツメ") {
    NormalAttackName = "おうごんのツメ攻撃";
  } else if (skillUser.gear?.name === "ハザードネイル") {
    NormalAttackName = "ハザードネイル攻撃";
  } else if (skillUser.gear?.name === "メガトンハンマー") {
    NormalAttackName = "通常攻撃アイアンヒット";
  } else if (skillUser.buffs.alwaysCrit) {
    NormalAttackName = "会心通常攻撃";
  } else if (skillUser.buffs.speedBasedAttack) {
    NormalAttackName = "魔獣の追撃";
  } else if (skillUser.race.includes("ゾンビ") && parties[skillUser.teamID].some((monster) => monster.name === "スカルスパイダー")) {
    NormalAttackName = "一族のけがれ攻撃";
  } else if (skillUser.flags.orugoDispelleUnbreakableAttack) {
    NormalAttackName = "通常攻撃時くじけぬ心を解除";
  } else if (skillUser.name === "守護神ゴーレム") {
    NormalAttackName = "防御力依存攻撃";
  } else if (skillUser.name === "ファイナルウェポン") {
    NormalAttackName = "アサルトシステム";
  } else if (skillUser.name === "凶帝王エスターク") {
    NormalAttackName = "イオ系攻撃";
  } else if (skillUser.name === "魔界の神バーン" && skillUser.buffs.vearnBarrier) {
    NormalAttackName = "絶大な力";
  } else if (skillUser.flags.abanTransformed) {
    NormalAttackName = "アバン通常攻撃息";
  }
  return NormalAttackName;
}

function col(argument) {
  console.log(argument);
}

function displayMiss(skillTarget) {
  displayMessage("しかし なにも おこらなかった！");
  displayDamage(skillTarget, 0);
}

// 自分を含めた数
function hasEnoughMonstersOfType(party, targetRace, requiredCount) {
  if (requiredCount <= 0) {
    return true; // requiredCountが0以下の場合はtrue
  }
  let count = 0;
  for (const monster of party) {
    if (monster && monster.race.includes(targetRace)) {
      count++;
    }
  }
  return count >= requiredCount;
}

// モンスター数を返す
function countSameRaceMonsters(monster) {
  let count = 0;
  for (const teamMonster of parties[monster.teamID]) {
    if (teamMonster && teamMonster.race.some((targetRace) => monster.race.includes(targetRace))) {
      count++;
    }
  }
  return count;
}

// 竜気 行動後に上げる
async function applyDragonPreemptiveAction(skillUser, executingSkill) {
  const aliveMasudora = parties[skillUser.teamID].filter((member) => member.id === "masudora" && !member.flags.isDead);
  const firstMasudora = aliveMasudora?.[0];
  const newStrength = Math.min((firstMasudora?.buffs?.dragonPreemptiveAction?.strength ?? 0) + 1, 9);
  for (const member of aliveMasudora) {
    member.buffs.dragonPreemptiveAction = { unDispellable: true, strength: newStrength };
    await updateMonsterBuffsDisplay(member);
  }
  displayMessage("マスタードラゴンの", `天の竜気レベルが ${newStrength}に上がった！`);
  // 涼風の場合はさらに増加可能性
  if (executingSkill.name === "涼風一陣" && Math.random() < 0.424) {
    await sleep(150);
    const ryouhuStrength = Math.min(newStrength + 1, 9);
    for (const member of aliveMasudora) {
      member.buffs.dragonPreemptiveAction = { unDispellable: true, strength: ryouhuStrength };
      await updateMonsterBuffsDisplay(member);
    }
    displayMessage("マスタードラゴンの", `天の竜気レベルが ${ryouhuStrength}に上がった！`);
  }
}

// 継続回復
async function executeContinuousHealing(monster) {
  if (monster.buffs.continuousHealing) {
    await sleep(200);
    applyHeal(monster, 275);
    await sleep(200);
  }
}

function addHexagonShine(targetElementId, cracked = false) {
  const targetElement = document.getElementById(targetElementId);
  if (!targetElement) {
    console.error("Target element not found.");
    return;
  }

  const hexagon = document.createElement("div");
  hexagon.style.position = "absolute";
  hexagon.style.width = "180%";
  hexagon.style.height = "180%";
  hexagon.style.top = "-45%";
  hexagon.style.clipPath = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
  hexagon.style.backgroundColor = "white";
  hexagon.style.opacity = "0.8";
  hexagon.style.mixBlendMode = "screen";
  hexagon.style.transformOrigin = "center"; // 回転の中心を設定

  targetElement.parentNode.appendChild(hexagon);

  hexagon.style.overflow = "hidden"; // 追加: ひび割れがクリップされないようにする

  if (cracked) {
    hexagon.style.opacity = "1";
    const cracks = document.createElement("div");
    cracks.style.position = "absolute";
    cracks.style.width = "100%";
    cracks.style.height = "100%";
    cracks.style.top = "0";
    cracks.style.left = "0";
    cracks.style.overflow = "visible"; // 追加: ひび割れがクリップされないようにする

    const numCracks = 20;
    for (let i = 0; i < numCracks; i++) {
      const crack = document.createElement("div");
      crack.style.position = "absolute";
      crack.style.width = "2px";
      crack.style.height = 50 + Math.random() * 20 + "%"; // ひびの長さを50%~70%でランダムに
      crack.style.background = "rgba(0, 0, 0, 0.3)";
      crack.style.transformOrigin = "bottom";
      crack.style.left = "calc(50% - 1px)";
      crack.style.bottom = "50%";

      const angle = (360 / numCracks) * i + Math.random() * 5 - 2.5; // ランダムな角度のずれを追加
      crack.style.transform = `rotate(${angle}deg)`;
      cracks.appendChild(crack);
    }
    hexagon.appendChild(cracks);
  }

  let timeOutDuration = 0;
  if (cracked) {
    hexagon.style.transition = "opacity 0.3s ease-in-out, transform 0.3s ease-in-out";
    timeOutDuration = 200;
  } else {
    hexagon.style.transition = "opacity 0.5s ease-in-out, transform 0.5s ease-in-out"; //もと0.5
    timeOutDuration = 300;
  }

  setTimeout(() => {
    hexagon.style.opacity = "0";
    if (cracked) {
      hexagon.style.transform = "scale(1.3)"; // 少し拡大しながら消える
    }
  }, 0);

  setTimeout(() => {
    hexagon.remove();
  }, timeOutDuration);
}
function adjustFieldStateDisplay() {
  const fieldStateDisplay1 = document.getElementById("fieldStateDisplay1");
  const fieldStateDisplay2 = document.getElementById("fieldStateDisplay2");
  let display1Content = "";
  let display2Content = "";

  if (fieldState.psychoField) {
    display1Content = "フィールド効果無効 残り1ラウンド";
  } else {
    if (fieldState.isReverse) {
      display1Content = fieldState.isPermanentReverse ? `リバース 残り11ラウンド` : `リバース 残り1ラウンド`;
    } else if (fieldState.disableReverse) {
      display1Content = `リバース無効 残り${fieldState.disableReverse}ラウンド`;
    }
    if (fieldState.isDistorted) {
      if (display1Content === "") {
        // display1が空ならdistortedをdisplay1に割り当てる
        display1Content = fieldState.isPermanentDistorted ? `属性歪曲 残り11ラウンド` : `属性歪曲 残り1ラウンド`;
      } else {
        // display1が埋まっているならdistortedをdisplay2に割り当てる
        display2Content = fieldState.isPermanentDistorted ? `属性歪曲 残り11ラウンド` : `属性歪曲 残り1ラウンド`;
      }
    }
  }

  // display1の表示設定
  if (display1Content === "") {
    fieldStateDisplay1.style.visibility = "hidden";
  } else {
    fieldStateDisplay1.style.visibility = "visible";
    fieldStateDisplay1.textContent = display1Content;
  }

  // display2の表示設定
  if (display2Content === "") {
    fieldStateDisplay2.style.visibility = "hidden";
  } else {
    fieldStateDisplay2.style.visibility = "visible";
    fieldStateDisplay2.textContent = display2Content;
  }
}
// 昇天
function ascension(monster, ignoreUnAscensionable = false) {
  if (!monster.flags.isZombie) {
    return;
  }
  if (!ignoreUnAscensionable && monster.flags.isUnAscensionable) {
    displayMiss(monster);
    return;
  }
  delete monster.flags.isZombie;
  // zombieBuffableのバフの一部を個別に削除  全削除：封印(黄泉・神獣・氷の王国)  個別削除：亡者の怨嗟鏡 死肉の怨嗟 憎悪の怨嗟 // 反撃ののろし 超魔改良 蘇生封じの術 グランドアビス 修羅の闇は残す
  delete monster.buffs.sealed;
  if (monster.buffs.slashReflection && monster.buffs.slashReflection.zombieBuffable) {
    delete monster.buffs.slashReflection;
  }
  if (monster.buffs.baiki && monster.buffs.baiki.zombieBuffable) {
    delete monster.buffs.baiki;
  }
  if (monster.buffs.paralyzedBreak && monster.buffs.paralyzedBreak.zombieBuffable) {
    delete monster.buffs.paralyzedBreak;
  }
  monster.flags.isDead = true;
  monster.commandInput = "skipThisTurn";
  updateMonsterBar(monster); //isDead付与後にupdateでbar非表示化
  updateBattleIcons(monster);
  /*
  let wrapper = document.getElementById(target.iconElementId).parentElement;
  const buffContainer = wrapper.querySelector(".buffContainer");
  if (buffContainer) {
    buffContainer.remove();
  }*/
  updateMonsterBuffsDisplay(monster);
  document.getElementById(monster.iconElementId).parentNode.classList.remove("stickOut");
  document.getElementById(monster.iconElementId).parentNode.classList.remove("recede");
}

function deleteUnbreakable(skillTarget) {
  if (!skillTarget.flags.isDead && !skillTarget.flags.isZombie) {
    delete skillTarget.buffs.isUnbreakable;
  }
}

function showCooperationEffect(currentTeamID, cooperationAmount) {
  const cooperationDisplayContainer = document.getElementById("cooperationDisplayContainer");
  const cooperationAmountSpan = document.getElementById("cooperationAmount");
  const cooperationMultiplierSpan = document.getElementById("cooperationMultiplier");

  // 連携数、倍率を設定
  cooperationAmountSpan.textContent = cooperationAmount;
  cooperationMultiplierSpan.textContent = {
    1: 1,
    2: 1.2,
    3: 1.3,
    4: 1.4,
    5: 1.5,
    6: 1.5,
  }[cooperationAmount];

  // 敵の場合色変更
  if (currentTeamID === 0) {
    cooperationDisplayContainer.style.color = "#ffaf06";
  } else {
    cooperationDisplayContainer.style.color = "#e72e2c";
  }

  // 初期状態：左に隠れている状態にする
  cooperationDisplayContainer.style.transform = "translateX(-100%)";
  cooperationDisplayContainer.style.visibility = "visible"; // 表示化

  // アニメーション開始：左からスライドイン
  setTimeout(() => {
    // 少し遅らせてアニメーションを滑らかにする
    cooperationDisplayContainer.style.transition = "transform 0.1s ease-in-out"; // transitionを追加
    cooperationDisplayContainer.style.transform = "translateX(0)";
  }, 10);

  // 一定時間後に非表示にする
  setTimeout(() => {
    cooperationDisplayContainer.style.transition = "opacity 0.1s ease-in-out"; // opacityのみtransitionを設定
    cooperationDisplayContainer.style.opacity = "0";

    cooperationDisplayContainer.addEventListener(
      "transitionend",
      function () {
        cooperationDisplayContainer.style.visibility = "hidden";
        cooperationDisplayContainer.style.opacity = "1";
        cooperationDisplayContainer.style.transition = ""; // transitionをリセット
      },
      { once: true }
    );
  }, 500);
}

// 戦闘終了判断
// updateIsBattleOverを分離してhandleDeathと昇天でisDead付与時に起動する案は保留
function isBattleOver() {
  if (fieldState.isBattleOver) {
    // 既にこの関数であるいはbtnで終了フラグが立てられている場合
    return true;
  } else if (parties.some((party) => party.every((monster) => monster.flags.isDead && !monster.flags.reviveNextTurn && !monster.flags.waitingForRevive))) {
    // どちらかのパテで、全員が死亡かつ次ターン蘇生もリザオ・tag・亡者化・供物変身による蘇生もない場合 戦闘終了フラグを立てる
    fieldState.isBattleOver = true;
    if (parties[0].every((monster) => monster.flags.isDead && !monster.flags.reviveNextTurn && !monster.flags.waitingForRevive)) {
      col("味方全滅により戦闘終了フラグが立てられました");
      displayMessage("試合をあきらめた");
    } else {
      col("敵全滅により戦闘終了フラグが立てられました");
      displayMessage(`${parties[1][0].name}たちを やっつけた！`);
    }
    stopBGM();
    return true;
  } else {
    return false;
  }
}

// 敵全滅判定
function isAllEnemyDead(monster) {
  return parties[monster.enemyTeamID].every((monster) => monster.flags.isDead);
}

// skip判断
function skipThisMonsterAction(skillUser) {
  // 敵全員が死亡または亡者で、かつ1体でも次ターン蘇生がいる場合
  if (
    !fieldState.isBattleOver &&
    parties[skillUser.enemyTeamID].every((monster) => monster.flags.isDead || monster.flags.isZombie) &&
    parties[skillUser.enemyTeamID].some((monster) => monster.flags.reviveNextTurn)
  ) {
    return true;
  } else {
    return false;
  }
}

function waitingMessage(skillUser) {
  if (skillUser) {
    col(`${skillUser.name}は ようすを うかがっている！`);
    displayMessage(`${skillUser.name}は`, "ようすを うかがっている！");
  }
}

// 体重計
function calculateWeight() {
  let weightSum = 0;
  for (const monster of selectingParty.filter((element) => Object.keys(element).length !== 0)) {
    weightSum += monster.weight;
    if (monster.gear && !monster.gear.noWeightMonsters?.includes(monster.name)) {
      weightSum += monster.gear.weight;
    }
  }
  document.getElementById("weightSum").textContent = `w${weightSum}`;
}

// isDeadもZombieも持たないランダムな味方を返す
function getRandomLivingPartyMember(skillUser) {
  const livingMembers = parties[skillUser.teamID].filter((member) => !member.flags.isDead && !member.flags.isZombie);

  if (livingMembers.length === 0) {
    return null; // 生きているメンバーがいない場合はnullを返す
  }

  const randomIndex = Math.floor(Math.random() * livingMembers.length);
  return livingMembers[randomIndex];
}

//反射持ちかつ反射無視でない かつ敵対象ならば反射化
function isSkillReflected(executingSkill, skillTarget) {
  return (
    executingSkill.targetTeam === "enemy" &&
    !executingSkill.ignoreReflection &&
    (skillTarget.buffs[executingSkill.type + "Reflection"] || (skillTarget.buffs.slashReflection && skillTarget.buffs.slashReflection.isKanta && executingSkill.type === "notskill"))
  );
}

// 使用不可の場合true
function isSkillUnavailableForAI(skillName) {
  const skillInfo = findSkillByName(skillName);
  const unavailableSkillsOnAI = [
    "エンドブレス",
    "ツイスター",
    "ツイスター下位",
    "神楽の術",
    "神楽の術下位",
    "閃く短刀",
    "キングストーム",
    "キングストーム下位",
    "ミナデイン",
    "ダークミナデイン",
    "グランドショット",
    "ビッグバンバースト",
    "会心斬",
    "真・獣王会心撃",
    "けがれの封印",
    "苦悶の魔弾",
    "メドローア",
    "禁呪マダンテ",
    "クロスマダンテ",
    "圧縮マダンテ",
    "呪いのベホマズン",
    "死神の大鎌",
    "凶帝王の双閃",
    "バイオスタンプ",
    "覇者の竜牙",
    "第三の瞳",
    "ギガ・マホトラ",
    "ギガ・マホヘル",
    "ザオリーマ",
    "王女の愛",
    "精霊の愛",
  ];
  const availableFollowingSkillsOnAI = ["必殺の双撃", "無双のつるぎ", "いてつくマヒャド", "クアトロマダンテ"];
  return (
    unavailableSkillsOnAI.includes(skillName) ||
    isWaveSkill(skillInfo) ||
    skillInfo.order !== undefined ||
    skillInfo.isOneTimeUse ||
    (skillInfo.followingSkill && !availableFollowingSkillsOnAI.includes(skillName))
  );
}

function intensityPoisonDepth(skillTarget) {
  if (skillTarget.buffs.poisonDepth && !skillTarget.flags.isdead && !skillTarget.flags.isZombie) {
    displayMessage(`${skillTarget.name}は`, "毒性深化が すすんだ！");
    skillTarget.buffs.poisonDepth.strength = Math.min(skillTarget.buffs.poisonDepth.strength + 2, 7);
  }
}

let YTplayer;
let iframe; // iframe要素への参照を保持
function onYouTubeIframeAPIReady() {
  YTplayer = new YT.Player("YTbgm", {
    events: {
      onReady: function () {
        console.log("Player is ready");
        iframe = document.getElementById("YTbgm"); // iframe要素を取得
      },
    },
  });
}

function toggleBGM() {
  if (YTplayer.getPlayerState() === YT.PlayerState.PLAYING) {
    stopBGM();
  } else {
    playBGM();
  }
}
function playBGM() {
  if (YTplayer) {
    if (document.getElementById("enableBGMCheckbox").checked) {
      YTplayer.seekTo(0); // 動画の先頭にシーク
      YTplayer.playVideo();
      if (iframe) {
        iframe.blur();
      }
    }
  }
}

function stopBGM() {
  if (YTplayer && YTplayer.getPlayerState() === YT.PlayerState.PLAYING) {
    initialVolume = YTplayer.getVolume(); // フェードアウト開始時のボリュームを保存
    let volume = initialVolume;
    const fadeOutInterval = 50; // フェードアウト間隔（ミリ秒）
    const fadeOutStep = 5; // ボリュームを減らすステップ

    let fadeOut = setInterval(() => {
      if (volume > 0) {
        volume = Math.max(0, volume - fadeOutStep); // ボリュームを減らす
        YTplayer.setVolume(volume);
      } else {
        clearInterval(fadeOut); // フェードアウト終了
        YTplayer.pauseVideo(); // 動画を停止
        if (iframe) {
          iframe.blur();
        }
        YTplayer.setVolume(initialVolume); // ボリュームを元に戻す
      }
    }, fadeOutInterval);
  }
}

// YouTube Iframe API をロード
var tag = document.createElement("script");
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
}

function countBreakMonster(party) {
  let count = 0;
  for (const monster of party) {
    if (isBreakMonster(monster)) {
      count++;
    }
  }
  return count;
}

function isBreakMonster(monster) {
  const breakMonsterList = [
    "ガルマザード",
    "ガルマッゾ",
    "凶帝王エスターク",
    "凶ライオネック",
    "凶ブオーン",
    "凶ウルトラメタキン",
    "凶メタルキング",
    "凶スターキメラ",
    "凶グレートオーラス",
    "凶シーライオン",
    "凶アンドレアル",
  ];
  return breakMonsterList.includes(monster.name);
}

// 耐性表示を全てクリア preparebattleでも実行して初期化
function clearAllSkillResistance() {
  const iconElements = ["enemyBattleIcon0", "enemyBattleIcon1", "enemyBattleIcon2", "enemyBattleIcon3", "enemyBattleIcon4"];
  for (const element of iconElements) {
    const targetWrapper = document.getElementById(element).parentNode;
    clearResistanceDisplay(targetWrapper);
  }
}

function clearResistanceDisplay(targetWrapper) {
  const existingResistance = targetWrapper.querySelector(".resistance-container");
  if (existingResistance) {
    existingResistance.remove();
  }
}

function displaySkillResistances(skillUser, originalSkillInfo) {
  clearAllSkillResistance();
  // originalがhowToCalc: "none"で、followingがnoneではないskillは対象を入れ替えて、適切な属性や反射表示を行う
  const followingSkills = ["昇天斬り", "昇天のこぶし", "蘇生封じの術", "真・カラミティエンド", "グランドアビス", "修羅の闇", "ミナデイン", "ダークミナデイン", "クロスレジェンド"];
  const skillInfo = followingSkills.includes(originalSkillInfo.name) ? findSkillByName(originalSkillInfo.followingSkill) : originalSkillInfo;

  if (skillInfo.targetTeam !== "enemy" || skillInfo.targetType === "dead" || skillInfo.targetType === "self") {
    return;
  }
  // 耐性計算対象となる属性を取得 例外は以下
  const targetElement = ["氷の王国", "神獣の氷縛"].includes(skillInfo.name) ? "ice" : skillInfo.element;

  for (const target of parties[skillUser.enemyTeamID]) {
    // 死亡時は削除のみ
    if (target.flags.isDead) {
      continue;
    }
    let wrapper = document.getElementById(target.iconElementId).parentNode;
    if (currentTeamIndex === 1) {
      wrapper = document.getElementById(target.reversedIconElementId).parentNode;
    }

    const resistanceValue = calculateResistance(skillUser, targetElement, target, fieldState.isDistorted, skillInfo);
    let resistanceText;
    let textColor;
    let iconType = null;

    if (resistanceValue !== -1 && isSkillReflected(skillInfo, target)) {
      resistanceText = "反射";
      textColor = "#c9caca"; //fbfafc
      iconType = "reflect";
    } else if (targetElement === "notskill" || (targetElement === "none" && resistanceValue === 1)) {
      // 反射以外で、通常攻撃または無属性かつ耐性普通の場合、非表示
      continue;
    } else if (targetElement === "none" && skillInfo.howToCalculate === "none") {
      // ダメージなし特技で無属性は非表示 氷の王国, 神獣の氷縛などは例外
      continue;
    } else {
      switch (resistanceValue) {
        case 2.5:
          resistanceText = "超弱点";
          textColor = "rgb(149, 221, 236)";
          iconType = "superWeak";
          break;
        case 2:
          resistanceText = "大弱点";
          textColor = "rgb(149, 221, 236)";
          iconType = "majorWeak";
          break;
        case 1.5:
          resistanceText = "弱点";
          textColor = "rgb(149, 221, 236)";
          iconType = "weak";
          break;
        case 1:
          resistanceText = "普通";
          textColor = "white";
          //iconTypeは設定しない
          break;
        case 0.75:
          resistanceText = "軽減";
          textColor = "#feb242";
          iconType = "reduce";
          break;
        case 0.5:
          resistanceText = "半減";
          textColor = "#f7772f";
          iconType = "half";
          break;
        case 0.25:
          resistanceText = "激減";
          textColor = "#d5382e";
          iconType = "greatlyReduce";
          break;
        case 0:
          resistanceText = "無効";
          textColor = "#d5382e";
          iconType = "invalid";
          break;
        case -1:
          resistanceText = "吸収";
          textColor = "#d58afb";
          iconType = "absorb";
          break;
      }
    }

    // コンテナ要素を作成
    const container = document.createElement("div");
    container.classList.add("resistance-container");
    //container.style.position = "absolute";
    wrapper.appendChild(container);

    // 属性表示
    const elementName = {
      fire: "メラ",
      ice: "ヒャド",
      thunder: "ギラ",
      wind: "バギ",
      io: "イオ",
      light: "デイン",
      dark: "ドルマ",
    }[targetElement];

    if (elementName && resistanceText !== "反射") {
      const elementTextElement = document.createElement("div");
      elementTextElement.classList.add("element-name-text");
      elementTextElement.textContent = elementName;
      // elementTextElement.style.position = "relative";
      elementTextElement.style.color = "#edfd19";
      elementTextElement.style.fontSize = "0.5rem";
      elementTextElement.style.zIndex = "11"; //一応
      container.appendChild(elementTextElement);
    }

    // 耐性表示
    const resistanceElement = document.createElement("div");
    resistanceElement.classList.add("resistance-text");
    resistanceElement.textContent = resistanceText;
    //resistanceElement.style.position = "relative";
    resistanceElement.style.color = textColor;
    if (iconType === "superWeak" || iconType === "majorWeak") {
      resistanceElement.style.fontSize = "0.8rem";
    } else {
      resistanceElement.style.fontSize = "1rem";
    }
    resistanceElement.style.borderRadius = "3px";
    resistanceElement.style.zIndex = "10";
    container.appendChild(resistanceElement);

    // アイコン表示
    if (iconType) {
      const iconElement = createResistanceIcon(iconType, textColor);
      container.appendChild(iconElement);
    }
  }
}

function createResistanceIcon(iconType, color) {
  const iconContainer = document.createElement("div");
  iconContainer.classList.add("resistance-icon");
  iconContainer.style.position = "absolute";
  iconContainer.style.zIndex = "9"; // resistance-textより下に配置
  iconContainer.style.height = "2rem";
  iconContainer.style.width = "2rem";
  iconContainer.style.display = "flex";
  iconContainer.style.justifyContent = "center";
  iconContainer.style.alignItems = "center";

  switch (iconType) {
    case "reflect":
      const reflectIcon = document.createElement("div");
      reflectIcon.style.width = "1.5rem";
      reflectIcon.style.height = "1.5rem";
      reflectIcon.style.backgroundColor = color;
      reflectIcon.style.transform = "rotate(45deg)";
      reflectIcon.style.border = "1.5px solid black";
      iconContainer.appendChild(reflectIcon);
      break;
    case "absorb":
      const absorbIcon = document.createElement("div");
      iconContainer.style.transform = "translate(0%, 15%)";
      absorbIcon.style.width = "1rem";
      absorbIcon.style.height = "1rem";
      absorbIcon.style.border = `0.2rem solid ${color}`;
      absorbIcon.style.borderRadius = "50%";
      iconContainer.appendChild(absorbIcon);
      break;
    case "invalid":
      const invalidIcon = document.createElement("div");
      iconContainer.style.transform = "translate(0%, 14%)";
      invalidIcon.style.position = "relative";
      invalidIcon.style.width = "1.9rem";
      invalidIcon.style.height = "1.9rem";

      const line1 = document.createElement("div");
      line1.style.position = "absolute";
      line1.style.top = "50%";
      line1.style.left = "50%";
      line1.style.transform = "translate(-50%, -50%) rotate(45deg)";
      line1.style.width = "1.9rem";
      line1.style.height = "0.5rem";
      line1.style.backgroundColor = color;

      const line2 = document.createElement("div");
      line2.style.position = "absolute";
      line2.style.top = "50%";
      line2.style.left = "50%";
      line2.style.transform = "translate(-50%, -50%) rotate(-45deg)";
      line2.style.width = "1.9rem";
      line2.style.height = "0.5rem";
      line2.style.backgroundColor = color;

      invalidIcon.appendChild(line1);
      invalidIcon.appendChild(line2);
      iconContainer.appendChild(invalidIcon);
      break;
    case "greatlyReduce":
      iconContainer.appendChild(createDownArrows(3, color));
      iconContainer.style.transform = "translate(0%, 55%)";
      break;
    case "half":
      iconContainer.appendChild(createDownArrows(2, color));
      iconContainer.style.transform = "translate(0%, 55%)";
      break;
    case "reduce":
      iconContainer.appendChild(createDownArrows(1, color));
      iconContainer.style.transform = "translate(0%, 55%)";
      break;
    case "weak":
      iconContainer.appendChild(createUpArrows(1, color));
      iconContainer.style.transform = "translate(0%, -30%)";
      break;
    case "majorWeak":
      iconContainer.appendChild(createUpArrows(2, color));
      iconContainer.style.transform = "translate(0%, -30%)";
      break;
    case "superWeak":
      iconContainer.appendChild(createUpArrows(3, color));
      iconContainer.style.transform = "translate(0%, -30%)";
      break;
  }

  return iconContainer;
}

function createDownArrows(count, color) {
  const arrowsContainer = document.createElement("div");
  arrowsContainer.style.display = "flex";

  for (let i = 0; i < count; i++) {
    const arrow = document.createElement("div");
    arrow.style.position = "relative";
    arrow.style.margin = "-0.2rem";
    // 真ん中だけ下げる
    if (count === 3 && i === 1) {
      arrow.style.transform = "translate(0%, 40%)";
    }

    // 三角形（傘）部分
    const triangle = document.createElement("div");
    triangle.style.width = "0";
    triangle.style.height = "0";
    triangle.style.borderLeft = "0.5rem solid transparent";
    triangle.style.borderRight = "0.5rem solid transparent";
    triangle.style.borderTop = `0.8rem solid ${color}`;

    // 長方形（柄）部分
    const rect = document.createElement("div");
    rect.style.position = "absolute";
    rect.style.top = "-1.6rem"; // 三角形の下に配置
    rect.style.left = "50%";
    rect.style.transform = "translateX(-50%)";
    rect.style.width = "0.5rem";
    rect.style.height = "1.6rem";
    rect.style.backgroundColor = color;

    arrow.appendChild(rect);
    arrow.appendChild(triangle);
    arrowsContainer.appendChild(arrow);
  }
  return arrowsContainer;
}

function createUpArrows(count, color) {
  const arrowsContainer = document.createElement("div");
  arrowsContainer.style.display = "flex";

  for (let i = 0; i < count; i++) {
    const arrow = document.createElement("div");
    arrow.style.position = "relative";
    arrow.style.margin = "-0.2rem";
    // 真ん中だけ下げる
    if (count === 3 && i === 1) {
      arrow.style.transform = "translate(0%, 40%)";
    }

    // 三角形（傘）部分
    const triangle = document.createElement("div");
    triangle.style.width = "0";
    triangle.style.height = "0";
    triangle.style.borderLeft = "0.5rem solid transparent";
    triangle.style.borderRight = "0.5rem solid transparent";
    triangle.style.borderBottom = `0.8rem solid ${color}`;

    // 長方形（柄）部分
    const rect = document.createElement("div");
    rect.style.position = "absolute";

    rect.style.left = "50%";
    rect.style.transform = "translateX(-50%)";
    rect.style.width = "0.5rem";
    rect.style.height = "1.6rem";
    rect.style.backgroundColor = color;

    arrow.appendChild(triangle);
    arrow.appendChild(rect);
    arrowsContainer.appendChild(arrow);
  }
  return arrowsContainer;
}

// global: presetCommands = []を使用 1ラウンド目のコマンド決定時に自動更新
function recordPresetCommands() {
  presetCommands.length = 0;
  for (const party of parties) {
    const partyPreset = [];
    for (const monster of party) {
      partyPreset.push({
        command: monster.commandInput,
        target: monster.commandTargetInput,
      });
    }
    presetCommands.push(partyPreset);
  }
}

// 記録したコマンドで対戦開始
document.getElementById("startBattleWithPresetCommandBtn").addEventListener("click", function () {
  // 非表示化 プリセット存在時に再戦等でpreparebattleが実行されれば再表示 finishBtn実行時はプリセット削除 一体でもコマンドを開始したらbtnは非表示
  document.getElementById("startBattleWithPresetCommandBtn").style.display = "none";
  startBattleWithPresetCommands();
});

function startBattleWithPresetCommands() {
  for (let partyIndex = 0; partyIndex < parties.length; partyIndex++) {
    const party = parties[partyIndex];
    const partyPreset = presetCommands[partyIndex];
    for (let monsterIndex = 0; monsterIndex < party.length; monsterIndex++) {
      if (partyPreset && partyPreset[monsterIndex]) {
        party[monsterIndex].commandInput = partyPreset[monsterIndex].command;
        party[monsterIndex].commandTargetInput = partyPreset[monsterIndex].target;
      }
    }
  }
  currentTeamIndex = 1;
  handleYesButtonClick();
}

function displaySkillDiscription(skillUser, skillInfo, displaySkillName) {
  const MPcost = calculateMPcost(skillUser, skillInfo);
  const SDproperties = createSDproperties(skillInfo);
  const SDmain = createSDmain(skillInfo);
  const SDappliedEffect = createSDappliedEffect(skillInfo);

  const args = [`${displaySkillName}＋3【消費MP：${MPcost}】`];
  // propertyも手動設定されている場合は反映
  if (skillInfo.discription1) {
    args.push(skillInfo.discription1);
  } else if (SDproperties) {
    args.push(SDproperties);
  }
  // property以降の文言について、個別指定されている場合はそれを参照
  if (skillInfo.discription2) {
    args.push(skillInfo.discription2);
    if (skillInfo.discription3) {
      args.push(skillInfo.discription3);
    }
  } else {
    // 手動設定がなければ自動生成
    if (SDmain) {
      args.push(SDmain);
    }
    if (SDappliedEffect) {
      args.push(SDappliedEffect);
    }

    // 元skillのdiscriptionが存在している場合のみ 現状はみだしているものが多い
    if ((SDmain || SDappliedEffect) && skillInfo.followingSkill && !["クアトロマダンテ"].includes(skillInfo.name)) {
      const followingSkill = findSkillByName(skillInfo.followingSkill);
      let Fmain = createSDmain(followingSkill);
      let FappliedEffect = createSDappliedEffect(followingSkill);
      const followingDiscription = Fmain || FappliedEffect ? `その後　${Fmain}${FappliedEffect}` : null;
      if (followingDiscription) {
        args.push(followingDiscription);
      }
    }
  }
  displayskillMessage(skillInfo, ...args);
}

// プロパティ生成
function createSDproperties(skillInfo) {
  const ignoreProperties = [];
  let ignorePropertiesText = "";
  if (["翠嵐の息吹", "竜の波濤", "冥闇の息吹", "業炎の息吹"].includes(skillInfo.name)) {
    ignoreProperties.push("領界変化");
  }
  if (skillInfo.isOneTimeUse) {
    ignoreProperties.push("戦闘中１回");
  }
  if (skillInfo.order === "preemptive") {
    ignoreProperties.push("先制");
  }
  if (skillInfo.order === "anchor") {
    ignoreProperties.push("アンカー");
  }
  if (skillInfo.ignoreEvasion || (skillInfo.howToCalculate === "fix" && skillInfo.name !== "ステテコダンス" && (skillInfo.type === "martial" || skillInfo.type === "dance"))) {
    ignoreProperties.push("みかわし不可");
  }
  if (skillInfo.ignoreDazzle || (skillInfo.howToCalculate === "fix" && skillInfo.name !== "キャンセルステップ" && (skillInfo.type === "martial" || skillInfo.type === "dance"))) {
    ignoreProperties.push("マヌーサ無効");
  }
  if (skillInfo.ignoreSubstitute) {
    ignoreProperties.push("みがわり無視");
  }
  if (skillInfo.ignoreReflection || isWaveSkill(skillInfo)) {
    ignoreProperties.push("反射無視");
  }
  if (skillInfo.ignoreProtection) {
    ignoreProperties.push("軽減無視");
  }
  if (skillInfo.ignoreGuard) {
    ignoreProperties.push("ぼうぎょ無視");
  }
  if (skillInfo.appliedEffect && skillInfo.appliedEffect.maso && !skillInfo.appliedEffect.maso.hasOwnProperty("strength")) {
    const maxDepth = skillInfo.appliedEffect.maso.maxDepth;
    ignoreProperties.push(`深度${maxDepth}まで`);
  }
  // 動作確認
  if (skillInfo.masoMultiplier && skillInfo.masoMultiplier[4] >= 5) {
    ignoreProperties.push("深度特効強");
  }
  if (skillInfo.penetrateStoned) {
    ignoreProperties.push("アストロン貫通");
  }
  if (skillInfo.name === "イオラの嵐") {
    ignoreProperties.push("鬼眼レベル2まで");
  }

  if (ignoreProperties.length > 0) {
    for (const property of ignoreProperties) {
      ignorePropertiesText += `【${property}】`;
    }
  }
  return ignorePropertiesText;
}

// 主要部分生成
function createSDmain(skillInfo) {
  let skillDiscriptionText = "";
  if (skillInfo.howToCalculate !== "none") {
    if (skillInfo.MPDamageRatio) {
      const MPcostText = skillInfo.MPcostRatio === 1 ? "全て" : `${skillInfo.MPcostRatio * 100}%`;
      skillDiscriptionText += `MPを${MPcostText}消費し　`;
    }
    if (skillInfo.targetTeam === "enemy") {
      skillDiscriptionText += "敵";
    } else if (skillInfo.targetTeam === "ally") {
      skillDiscriptionText += "味方";
    }
    if (skillInfo.targetType === "single") {
      skillDiscriptionText += "1体に";
    } else if (skillInfo.targetType === "all") {
      skillDiscriptionText += "全体に";
    } else if (skillInfo.targetType === "random") {
      skillDiscriptionText = "ランダムに"; //上書き
    }
    if (skillInfo.hitNum) {
      skillDiscriptionText += `${skillInfo.hitNum}回　`;
    } else {
      skillDiscriptionText += "　";
    }

    if (skillInfo.ratio) {
      if (skillInfo.howToCalculate === "atk") {
        skillDiscriptionText += "攻撃力依存で　";
      } else if (skillInfo.howToCalculate === "def") {
        skillDiscriptionText += "防御力依存で　";
      } else if (skillInfo.howToCalculate === "spd") {
        skillDiscriptionText += "素早さ依存で　";
      } else if (skillInfo.howToCalculate === "int") {
        skillDiscriptionText += "賢さ依存で　";
      }
    } else if (skillInfo.howToCalculate === "fix" && skillInfo.damageByLevel) {
      skillDiscriptionText += "レベル依存で　";
    } else if (skillInfo.howToCalculate === "int" && skillInfo.type !== "spell") {
      skillDiscriptionText += "呪文計算で　";
    } else if (skillInfo.MPDamageRatio) {
      skillDiscriptionText += "消費量に応じて　";
    }

    const elementName = {
      fire: "メラ系の",
      ice: "ヒャド系の",
      thunder: "ギラ系の",
      wind: "バギ系の",
      io: "イオ系の",
      light: "デイン系の",
      dark: "ドルマ系の",
      none: "無属性の",
    }[skillInfo.element];
    if (elementName) {
      skillDiscriptionText += `${elementName}`;
    }
    const skillTypeName = gerSkillTypeName(skillInfo.type);
    if (skillTypeName) {
      skillDiscriptionText += `${skillTypeName}攻撃　`;
    }
  }
  return skillDiscriptionText;
}

// 追加効果生成
function createSDappliedEffect(skillInfo) {
  let skillDiscriptionText = "";
  let appliedEffectText = "";
  let isStackableBuffExisting;

  // 追加効果用textを用意
  if (skillInfo.appliedEffect === "disruptiveWave") {
    appliedEffectText = "状態変化を解除　";
    isStackableBuffExisting = true; // "の"にする
  } else if (skillInfo.appliedEffect === "divineWave") {
    appliedEffectText = "状態変化を解除（上位効果）　";
    isStackableBuffExisting = true; // "の"にする
  } else if (skillInfo.appliedEffect && typeof skillInfo.appliedEffect !== "string") {
    const result = getBuffName(skillInfo.appliedEffect);
    appliedEffectText = result[0]; // 空白は既に含まれている
    isStackableBuffExisting = result[1];
  }

  // ダメージあり
  if (skillInfo.howToCalculate !== "none") {
    if (skillInfo.weakness18) {
      skillDiscriptionText += "弱点倍率が1.8倍　";
    }
    if (skillInfo.criticalHitProbability && skillInfo.criticalHitProbability === 1) {
      skillDiscriptionText += "この攻撃は　必ず会心の一撃になる　";
    } else if (skillInfo.criticalHitProbability && skillInfo.criticalHitProbability !== 0) {
      skillDiscriptionText += "会心の一撃が出やすい　";
    }

    // 追加効果
    if (skillInfo.name === "失望の光舞") {
      skillDiscriptionText += "命中時　状態変化・くじけぬ心解除　";
    } else if (skillInfo.name === "絶望の天舞") {
      skillDiscriptionText += "命中時　状態変化解除（上位効果）・くじけぬ心解除　";
    } else if (skillInfo.name === "天の裁き") {
      skillDiscriptionText += "命中時　確率でくじけぬ心を解除する　";
    } else if (skillInfo.name === "ほとばしる暗闇" || skillInfo.name === "すさまじいオーラ") {
      skillDiscriptionText += "命中時　状態変化・ため状態を解除する　";
    } else if (appliedEffectText) {
      skillDiscriptionText += `命中時　${appliedEffectText}`;
    } else if (skillInfo.act) {
      const expectedAct = "function(skillUser,skillTarget){deleteUnbreakable(skillTarget);}"; //ぶちのめす 真カラミは同時にappliedありだが省略
      const actString = skillInfo.act.toString().replace(/\s/g, "");
      if (actString === expectedAct) {
        skillDiscriptionText += "命中時　くじけぬ心を解除する　";
      }
    }

    if (skillInfo.RaceBane) {
      skillDiscriptionText += `${skillInfo.RaceBane.join("・")}系に　威力${skillInfo.RaceBaneValue}倍　`;
    }
    // HP割合依存
    if (skillInfo.damageByHpPercent) {
      skillDiscriptionText += "自分の残りHPが多いほど　威力大　";
    }
    // HP割合反転依存
    if (skillInfo.lowHpDamageMultiplier) {
      skillDiscriptionText += "自分の残りHPが少ないほど　威力大　";
    }
  } else {
    // ダメージなしの場合
    if (appliedEffectText) {
      // 助詞を選択 stackable存在時またはactがいてはの場合、"の"
      const josi = isStackableBuffExisting ? "の　" : "を　";
      // 対象を追加
      if (skillInfo.targetTeam === "enemy") {
        skillDiscriptionText += "敵";
      } else if (skillInfo.targetTeam === "ally") {
        skillDiscriptionText += "味方";
      }
      if (skillInfo.targetType === "single") {
        skillDiscriptionText += `1体${josi}`;
      } else if (skillInfo.targetType === "all") {
        skillDiscriptionText += `全体${josi}`;
      }

      // ランダムは完全上書き
      if (skillInfo.targetType === "random") {
        skillDiscriptionText = "ランダムに　";
      }
      // 追加効果textを追加 (命中時表記はしない)
      skillDiscriptionText += `${appliedEffectText}`;
    }
  }

  // ダメージ有無にかかわらず適用
  if (skillInfo.ignoreTypeEvasion) {
    const skillTypeName = gerSkillTypeName(skillInfo.type);
    if (skillTypeName) {
      skillDiscriptionText += `${skillTypeName}無効状態を貫通する　`;
    }
  }
  return skillDiscriptionText;
}

function gerSkillTypeName(skillType) {
  return {
    spell: "呪文",
    slash: "斬撃",
    martial: "体技",
    breath: "息",
    ritual: "儀式",
    dance: "踊り",
  }[skillType];
}

function getBuffName(appliedEffect) {
  // 何段階上げる/下げると表記される群
  const stackableBuffNameList = {
    baiki: "攻撃力",
    defUp: "防御力",
    spdUp: "素早さ",
    intUp: "賢さ",
    spellBarrier: "呪文防御",
    slashBarrier: "斬撃防御",
    martialBarrier: "体技防御",
    breathBarrier: "息防御",
    fireResistance: "メラ耐性",
    iceResistance: "ヒャド耐性",
    thunderResistance: "ギラ耐性",
    windResistance: "バギ耐性",
    ioResistance: "イオ耐性",
    lightResistance: "デイン耐性",
    darkResistance: "ドルマ耐性",
    zakiResistance: "ザキ耐性",
    kiganLevel: "鬼眼レベル",
    maso: "マソ深度",
  };

  // まとめて--状態とつけられる群
  const abnormalityBuffNameList = {
    //powerChargeなど
    //damageLimit: `被ダメージ上限値${buffData.strength}`
    //statusLock: "状態変化を封じる",
    //反射
    //familybuff
    //dodgeBuff

    spellSeal: "呪文封じ",
    breathSeal: "息封じ",
    slashSeal: "斬撃封じ",
    martialSeal: "体技封じ",
    fear: "行動停止",
    tempted: "みりょう",
    sealed: "封印",
    asleep: "眠り",
    confused: "混乱",
    paralyzed: "マヒ",
    stoned: "石化",
    dazzle: "マヌーサ",
    poisoned: "猛毒",
    dotDamage: "継続ダメージ",
    dotMPdamage: "継続MPダメージ",
    MPabsorption: "MP吸収",
    healBlock: "回復封じ",
    reviveBlock: "蘇生封じ",
    zombifyBlock: "執念封じ",
    murakumo: "息被ダメージ上昇",
    crimsonMist: "被ダメージ33%上昇", // 波濤 深淵の儀式
    manaReduction: "呪文ダメージ50%減少", // 浸食 闇討ち 宵 深淵の儀式
    powerWeaken: "攻撃ダメージ50%減少", // 浸食 邪悪な灯火

    revive: "自動復活",
    sacredBarrier: "状態異常無効",
    confusionBarrier: "混乱無効",
    mindBarrier: "行動停止無効",
    /*
    spellEvasion: "呪文無効状態",
    slashEvasion: "斬撃無効状態",
    martialEvasion: "体技無効状態",
    breathEvasion: "息無効状態",
    ritualEvasion: "儀式無効状態",
    danceEvasion: "踊り無効状態",
    spellReflection: "呪文反射状態",
    slashReflection: "斬撃反射状態",
    martialReflection: "体技反射状態",
    breathReflection: "息反射状態",
    ritualReflection: "儀式反射状態",
    danceReflection: "踊り反射状態",
    */
  };

  const specialBuffHandlers = {
    protection: (buffData) => `ダメージ${buffData.strength * 100}%軽減`,
    countDown: (buffData) => `カウント${buffData.count}`,
  };

  let stackableBuffsToApply = [];
  let stackableBuffsStrength = 1;
  let stackabledeBuffsToApply = [];
  let stackabledeBuffsStrength = 1;
  let stackableProbabilityExists = false;
  let abnormalityBuffsToApply = [];
  let abnormalityProbabilityExists = false;

  let discriptionText = "";

  for (const buffName in appliedEffect) {
    const buffData = appliedEffect[buffName];

    if (stackableBuffNameList[buffName]) {
      if (buffData.strength > 0 || buffName === "maso") {
        stackableBuffsToApply.push(`${stackableBuffNameList[buffName]}`);
        stackableBuffsStrength = buffData.strength || 1;
      } else {
        stackabledeBuffsToApply.push(`${stackableBuffNameList[buffName]}`);
        stackabledeBuffsStrength = buffData.strength * -1 || 1;
      }
      // "確率で"表示をするか
      if (buffData.probability || (buffName === "maso" && !buffData.strength)) {
        stackableProbabilityExists = true;
      }
    } else {
      let text;
      if (specialBuffHandlers[buffName]) {
        text = specialBuffHandlers[buffName](buffData);
      } else if (abnormalityBuffNameList[buffName]) {
        text = abnormalityBuffNameList[buffName];
      }
      if (text) {
        // 調整
        if (buffName === "poisoned" && buffData.isLight) {
          text = "毒";
        }
        if (["poisoned", "healBlock", "reviveBlock", "countDown"].includes(buffName) && buffData.unDispellableByRadiantWave) {
          text = `解除不可の${text}`;
        }
        abnormalityBuffsToApply.push(`${text}`);
        // "確率で"表示をするか
        if (buffData.probability) {
          abnormalityProbabilityExists = true;
        }
      }
    }
  }

  let shouldFixLastWord = false;
  let isStackableBuffExisting = false;
  if (stackableBuffsToApply.length > 0) {
    shouldFixLastWord = true;
    isStackableBuffExisting = true;
    let text = `${stackableBuffsToApply.join("・")}を${stackableBuffsStrength}段階上げ　`;
    text = stackableProbabilityExists ? `確率で${text}` : text;
    // マソのみ重複がないのでここで完全に置換
    if (stackableBuffsToApply[0] === "マソ深度" && appliedEffect.maso.strength) {
      isStackableBuffExisting = false;
      text = `マソ深度${appliedEffect.maso.strength}にす　`;
    }
    discriptionText += `${text}`;
  }
  if (stackabledeBuffsToApply.length > 0) {
    shouldFixLastWord = true;
    isStackableBuffExisting = true;
    let text = `${stackabledeBuffsToApply.join("・")}を${stackabledeBuffsStrength}段階下げ　`;
    text = stackableProbabilityExists && stackableBuffsToApply.length <= 0 ? `確率で${text}` : text;
    discriptionText += `${text}`;
  }
  if (abnormalityBuffsToApply.length > 0) {
    shouldFixLastWord = false; // 置換不要
    let text = `${abnormalityBuffsToApply.join("・")}状態にする　`;
    text = abnormalityProbabilityExists && !(stackableProbabilityExists && (stackableBuffsToApply.length > 0 || stackabledeBuffsToApply.length > 0)) ? `確率で${text}` : text;
    discriptionText += `${text}`;
  }
  // 必要ならば最後の文字を置換
  if (shouldFixLastWord) {
    discriptionText = discriptionText.slice(0, -1) + "る　";
  }

  return [discriptionText, isStackableBuffExisting];
}

function isWaveSkill(skillInfo) {
  return skillInfo.howToCalculate === "none" && (skillInfo.appliedEffect === "disruptiveWave" || skillInfo.appliedEffect === "divineWave");
}

document.getElementById("spdSetting").addEventListener("change", function (event) {
  waitMultiplier = Number(event.target.value);
});

function applyShihai(skillTarget, originalTarget = null) {
  // 次ターン最初のattackAbility時点まで所持していれば みがわり・行動停止を実行 石化 死亡 亡者化で解除 現状重ねがけによる毎ターン強制みがわりが可能
  applyBuff(skillTarget, { boogieCurse: { dispellableByRadiantWave: true, duration: 2, removeAtTurnStart: true, iconSrc: "willSubstitute" } });
  // 支配を既に予約している場合は重複付与しない
  if (skillTarget.abilities.attackAbilities.nextTurnAbilities.some((ability) => ability.name === "しはいのさくせんみがわり実行")) return;
  // ひれつを既に予約している場合は削除
  skillTarget.abilities.attackAbilities.nextTurnAbilities = skillTarget.abilities.attackAbilities.nextTurnAbilities.filter((ability) => ability.name !== "ひれつなさくせんみがわり実行");

  displayMessage(`${skillTarget.name}は`, "次のラウンドで 敵の みがわりになる！");
  // 次ターン行動停止&みがわり実行を付与
  skillTarget.abilities.attackAbilities.nextTurnAbilities.push({
    name: "しはいのさくせんみがわり実行",
    disableMessage: true,
    unavailableIf: (skillUser) => !skillUser.buffs.boogieCurse,
    act: async function (skillUser) {
      delete skillUser.buffs.boogieCurse;
      const aliveEnemies = parties[skillUser.enemyTeamID].filter((monster) => !monster.flags.isDead);
      // 状態異常でない場合のみみがわり実行
      if (!hasAbnormality(skillUser) && aliveEnemies.length > 0) {
        const randomTarget = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        displayMessage(`${skillUser.name}は`, "敵の みがわりに なった！");
        await sleep(200);
        applySubstitute(skillUser, randomTarget, false, false, true); // isBoogie(光の波動解除フラグ)をtrueで送る
      } else {
        displayMiss(skillUser);
      }
      // みがわり実行の成否やみがわり先被りによる失敗にかかわらず行動停止を付与 hasAbnormalityに引っかからないようにみがわり判定後に付与
      applyBuff(skillUser, { boogieCurseSubstituting: { dispellableByRadiantWave: true, duration: 1, removeAtTurnStart: true } });
    },
  });
  // 死亡時転移を付与
  if (!skillTarget.abilities.additionalDeathAbilities.some((ability) => ability.name === "しはいのさくせん転移")) {
    skillTarget.abilities.additionalDeathAbilities.push({
      name: "しはいのさくせん転移",
      message: function (skillUser) {
        displayMessage(`${skillUser.name} がチカラつき`, "しはいのさくせん の効果が発動！");
      },
      unavailableIf: (skillUser) => !skillUser.flags.buffKeysOnDeath.includes("boogieCurseSubstituting"), // みがわり実行ターン attackによるバフ付与後、死亡時にまだ保持していた場合のみ転移
      act: async function (skillUser) {
        const aliveAllys = parties[skillUser.teamID].filter((monster) => !monster.flags.isDead && !monster.flags.isZombie && monster.monsterId !== skillUser.monsterId);
        if (aliveAllys.length > 0) {
          const randomTarget = aliveAllys[Math.floor(Math.random() * aliveAllys.length)];
          await sleep(130);
          applyShihai(randomTarget, skillUser);
        }
      },
    });
  }
  // 転移元が存在する場合、転移元から削除
  if (originalTarget) {
    originalTarget.abilities.attackAbilities.nextTurnAbilities = originalTarget.abilities.attackAbilities.nextTurnAbilities.filter((ability) => ability.name !== "しはいのさくせんみがわり実行");
    originalTarget.abilities.additionalDeathAbilities = originalTarget.abilities.additionalDeathAbilities.filter((ability) => ability.name !== "しはいのさくせん転移");
  }
}

function isRubisTarget(monster) {
  const raceName = monster.race[0];
  if (monster.name === "名もなき闇の王") {
    return "hazama";
  } else if (raceName === "超魔王" || raceName === "超伝説") {
    return false;
  } else {
    return raceName;
  }
}

function countRubisTarget(party) {
  let raceSet = new Set();
  for (const teamMonster of party) {
    // 存在確認
    if (Object.keys(teamMonster).length !== 0) {
      const race = isRubisTarget(teamMonster);
      if (race) {
        raceSet.add(race);
      }
    }
  }
  return raceSet.size;
}

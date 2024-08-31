//初期処理
document.getElementById("battlepage").style.display = "none";
const defaultMonster = {
  name: "未選択",
  id: "unselected",
  type: "",
  status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 0 },
  skill: ["なし", "なし", "なし", "なし"],
  attribute: "",
  seed: { atk: 0, def: 0, spd: 0, int: 0 },
  gear: {
    name: "",
    id: "ungeared",
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 0 },
    effect: "none",
  },
  gearzoubun: {
    HP: 0,
    MP: 0,
    atk: 0,
    def: 0,
    spd: 0,
    int: 0,
  },
};

const defaultparty = Array(5).fill(defaultMonster);

let allparties = Array.from({ length: 10 }, () => ({ party: [...defaultparty] }));
//全パテの枠組みを用意
let parties = [{ party: [...defaultparty] }, { party: [...defaultparty] }];
//対戦に用いる2つのパテの枠組みを用意

// allparties[0].party が party1

let party = [...defaultparty];
let selectingpartynum = 1;
//party初期化

function selectparty() {
  //パテ切り替え時に起動
  // 現在の仮partyのdeep copyを、allparties内のselectingpartynum-1で指定された番目に格納
  allparties[selectingpartynum - 1].party = structuredClone(party);
  // selectingpartyを選択値に更新
  selectingpartynum = parseInt(document.getElementById("selectparty").value);
  //仮partyにallparties内の情報を下ろす
  party = structuredClone(allparties[selectingpartynum - 1].party);
  //party.splice(0, party.length, ...window[newparty]);

  //頭モンスターを選択状態に
  //これで、icon2種、ステ、種増分、種選択、特技の表示更新も兼ねる
  switchTab(1);

  function updateImage(elementId, id, gearId) {
    var iconSrc = id ? "images/icons/" + id + ".jpeg" : "images/icons/unselected.jpeg";
    var gearSrc = gearId ? "images/gear/" + gearId + ".jpeg" : "images/gear/ungeared.jpeg";

    document.getElementById(elementId).src = iconSrc;
    document.getElementById("partygear" + elementId.slice(-1)).src = gearSrc;
  }
  //partyの中身のidとgearidから、適切な画像を設定
  updateImage("partyicon1", party[0]?.id, party[0]?.gear?.id);
  updateImage("partyicon2", party[1]?.id, party[1]?.gear?.id);
  updateImage("partyicon3", party[2]?.id, party[2]?.gear?.id);
  updateImage("partyicon4", party[3]?.id, party[3]?.gear?.id);
  updateImage("partyicon5", party[4]?.id, party[4]?.gear?.id);
}

//どちらのプレイヤーがパテ選択中かの関数定義
let allyorenemy = "ally";
function confirmparty() {
  const selectpartymanipu = document.getElementById("selectparty");

  //todo:もしpartyの中にunselectedやungearedが入っていたらalertしてesc

  if (allyorenemy === "ally") {
    //状態の保存とselect入れ替え
    allyorenemy = "enemy";
    document.getElementById("playerAorB").textContent = "プレイヤーB";
    //新しいoptionを追加
    for (let i = 6; i <= 10; i++) {
      selectpartymanipu.innerHTML += `<option value="${i}">パーティ${i - 5}</option>`;
    }
    document.getElementById("selectparty").value = 6;
    //現在の仮partyを対戦用partiesにcopyして確定、selectpartyを6にして敵を表示状態にした上で
    //selectparty関数で通常通り、未変更のallpartyies内のselectingpartynum-1番目に仮partyを格納、enemy編成をhtmlに展開
    parties[0] = structuredClone(party);
    selectparty();
    // 1から5までの選択肢を削除
    selectpartymanipu.querySelectorAll('option[value="1"], option[value="2"], option[value="3"], option[value="4"], option[value="5"]').forEach((option) => option.remove());
  } else {
    //状態の保存とselect入れ替え
    allyorenemy = "ally";
    document.getElementById("playerAorB").textContent = "プレイヤーA";
    //新しいoptionを追加
    for (let i = 1; i <= 5; i++) {
      selectpartymanipu.innerHTML += `<option value="${i}">パーティ${i}</option>`;
    }
    document.getElementById("selectparty").value = 1;
    parties[1] = structuredClone(party);
    selectparty();
    //これで戦闘画面から戻った場合はplayer1のparty1が表示
    //6-10を削除
    selectpartymanipu.querySelectorAll('option[value="6"], option[value="7"], option[value="8"], option[value="9"], option[value="10"]').forEach((option) => option.remove());
    //displayで全体切り替え、attle画面へ
    document.getElementById("adjustpartypage").style.display = "none";
    document.getElementById("battlepage").style.display = "block";
    preparebattle();
    preloadImages();
  }
}

//パテ設定画面の確定で起動
function preparebattle() {
  //初期化
  fieldState = { turnNum: 0 };
  //敵味方識別子を追加
  parties.forEach((party, index) => {
    party.forEach((member) => {
      member.teamID = index;
      // 敵チームIDを付与
      member.enemyTeamID = index === 0 ? 1 : 0;
    });
  });

  // 以下はパーティごとに処理
  for (const party of parties) {
    // リーダースキルの取得 (ループ外に移動)
    const leaderSkill = party[0].ls;
    const lstarget = party[0].lstarget;

    // 各モンスターについて処理
    for (const monster of party) {
      // defaultstatusを直接定義
      monster.defaultstatus = {};

      // ループを統合してステータスをコピー&リーダースキルを適用
      for (const key in monster.displaystatus) {
        monster.defaultstatus[key] = monster.displaystatus[key];
        //ls反映済のdefaultstatus生成

        // lstargetがallまたはモンスターのタイプと一致する場合のみリーダースキル適用
        if (lstarget === "all" || monster.type === lstarget) {
          if (leaderSkill[key]) {
            monster.defaultstatus[key] = Math.ceil(monster.defaultstatus[key] * leaderSkill[key]);
          }
        }
      }

      // currentstatusをdefaultstatusのコピーとして生成
      monster.currentstatus = structuredClone(monster.defaultstatus);

      // 初期生成
      monster.confirmedcommand = "";
      monster.confirmedcommandtarget = "";
      monster.buffs = {};
      monster.flags = {};
      monster.abilities = {};
    }
  }
  //iconとbarのelement idを格納
  for (let i = 0; i < parties.length; i++) {
    const party = parties[i];
    for (let j = 0; j < party.length; j++) {
      const monster = party[j];

      // 接頭辞を設定 (ally または enemy)
      const prefix = i === 0 ? "ally" : "enemy";

      // 各要素のIDを作成
      const iconId = `battleicon${prefix}${j}`;
      const hpBarId = `hpbar${prefix}${j}`;
      const mpBarId = `mpbar${prefix}${j}`;
      const hpBarTextId = `hpbartext${prefix}${j}`;
      const mpBarTextId = `mpbartext${prefix}${j}`;

      // オブジェクトにIDを追加
      monster.index = j;
      monster.monsterId = `parties[${i}][${j}]`;
      monster.iconElementId = iconId;
      monster.hpBarElementId = hpBarId;
      monster.mpBarElementId = mpBarId;
      monster.hpBarTextElementId = hpBarTextId;
      monster.mpBarTextElementId = mpBarTextId;
    }
  }
  //初期生成後にバフ表示を開始
  for (const party of parties) {
    for (const monster of party) {
      updateMonsterBar(monster);
    }
  }

  //戦闘画面の10のimgのsrcを設定
  //partyの中身のidとgearidから、適切な画像を設定
  preparebattlepageicons();
  //field管理用変数の導入はglobalで
  startTurn();
}
//finish preparebattle 開始時処理終了

let fieldState = { turnNum: 0 };

//targetTeamごとに特技target選択画面で起動
function setElementIcon(elementId, id) {
  const iconSrc = "images/icons/" + id + ".jpeg";
  document.getElementById(elementId).src = iconSrc;
}

//死亡処理で起動、死亡時や亡者化のicon変化処理、preparebattlepageiconsでも起動して敵skill選択時の反転にそれを反映する
//状態を変化させてから配列を渡せば、状態に合わせて自動的に更新
function updatebattleicons(monster, reverse = false) {
  const side = reverse ? 1 - monster.teamID : monster.teamID;
  const elementId = `battleicon${side === 0 ? "ally" : "enemy"}${monster.index}`;
  const iconElement = document.getElementById(elementId);
  iconElement.src = "images/icons/" + monster.id + ".jpeg";

  iconElement.style.display = "flex";
  //sideが1かつ死亡は非表示、0かつ死亡は暗転、亡者は全て中間
  if (side === 1 && monster.flags?.isDead) {
    iconElement.style.display = "none";
  } else {
    if (monster.flags?.isZombie) {
      iconElement.style.filter = "brightness(80%)"; //todo:不要か？
    } else if (!monster.flags?.isZombie && side !== 1 && monster.flags?.isDead) {
      iconElement.style.filter = "brightness(25%)";
    } else {
      iconElement.style.filter = "brightness(100%)";
    }
  }
}

//敵コマンド入力時に引数にtrueを渡して一時的に反転 反転戻す時と初期処理では引数なしで通常表示
function preparebattlepageicons(reverse = false) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 5; j++) {
      // parties[i][j] が存在する場合のみ updatebattleicons を実行
      if (parties[i][j]) {
        updatebattleicons(parties[i][j], reverse);
      }
    }
  }
}

//HPMPのテキスト表示とバーを更新する これは戦闘開始時と毎ダメージ処理後applydamage内で起動
//HPかつdamageがある場合はdamageに代入することで赤いバー表示、isReversedはskill選択時
function updateMonsterBar(monster, damage = 0, isReversed = false) {
  // IDのプレフィックスを切り替える
  let prefix = monster.hpBarElementId.startsWith("hpbarally") ? "ally" : "enemy";
  if (isReversed) {
    prefix = prefix === "ally" ? "enemy" : "ally"; // 逆転フラグがtrueならプレフィックスを反転
  }

  // IDを生成
  const hpBarInnerId = `hpbarinner${prefix}${monster.hpBarElementId.slice(monster.hpBarElementId.length - 1)}`;
  const mpBarInnerId = `mpbarinner${prefix}${monster.mpBarElementId.slice(monster.mpBarElementId.length - 1)}`;
  const hpBarTextElementId = `hpbartext${prefix}${monster.hpBarTextElementId.slice(monster.hpBarTextElementId.length - 1)}`;
  const mpBarTextElementId = `mpbartext${prefix}${monster.mpBarTextElementId.slice(monster.mpBarTextElementId.length - 1)}`;

  // 表示対象の要素を取得
  const hpBarElement = document.getElementById(hpBarInnerId.replace("hpbarinner", "hpbar"));
  const hpBarInner = document.getElementById(hpBarInnerId);
  const hpBarTextElement = document.getElementById(hpBarTextElementId);
  const mpBarInner = document.getElementById(mpBarInnerId);
  const mpBarTextElement = document.getElementById(mpBarTextElementId);

  // HPバーの表示/非表示制御
  if (prefix === "enemy" && (monster.flags.isDead || monster.flags.isZombie)) {
    // prefixがenemy enemy側表示かつ、isDeadまたはisZombieの場合は非表示
    hpBarElement.style.display = "none";
  } else {
    // それ以外の場合は表示
    hpBarElement.style.display = "block"; // blockまたは元々のdisplayスタイルに戻す

    // HPバーの更新
    const currentHpPercentage = parseFloat(hpBarInner.style.width); // 現在の幅を取得
    const hpPercentage = (monster.currentstatus.HP / monster.defaultstatus.HP) * 100;
    hpBarInner.style.width = `${hpPercentage}%`; // 即座に幅を更新

    // ダメージ表示
    const damageDisplayId = `damagedisplay${hpBarInnerId.slice(10)}`;
    const damageDisplay = document.getElementById(damageDisplayId);

    if (damage > 0 && damageDisplay) {
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

    // テキストの更新 敵monsterはtext存在しないのでnullcheck
    if (hpBarTextElement) {
      hpBarTextElement.textContent = monster.currentstatus.HP;
    }
  }

  // MPバーの更新 (常に表示)
  const mpPercentage = (monster.currentstatus.MP / monster.defaultstatus.MP) * 100;
  mpBarInner.style.width = `${mpPercentage}%`;
  if (mpBarTextElement) {
    mpBarTextElement.textContent = monster.currentstatus.MP;
  }
}

//敵skill選択時に起動
function reverseMonsterBarDisplay() {
  for (let i = 0; i < parties.length; i++) {
    for (let j = 0; j < parties[i].length; j++) {
      updateMonsterBar(parties[i][j], "", true); // 逆転フラグをtrueで渡す
      updateMonsterBuffsDisplay(parties[i][j], true);
    }
  }
}
//全部元にもどして通常表示
function restoreMonsterBarDisplay() {
  for (let i = 0; i < parties.length; i++) {
    for (let j = 0; j < parties[i].length; j++) {
      updateMonsterBar(parties[i][j]);
      updateMonsterBuffsDisplay(parties[i][j]);
    }
  }
}

//////////////////////////////////////////////////////////////コマンド選択フロー

let selectingwhichmonsterscommand = 0;
let selectingwhichteamscommand = 0;

//////////////通常攻撃
document.getElementById("commandnormalattackbtn").addEventListener("click", function () {
  disablecommandbtns(true);
  parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommand = "通常攻撃";
  document.getElementById("selectcommandpopupwindow-text").textContent = "たたかう敵モンスターをタッチしてください。";
  document.getElementById("selectcommandpopupwindow-text").style.visibility = "visible";
  selectskilltargettoggler(selectingwhichteamscommand === 0 ? 1 : 0, "single", "enemy", findSkillByName("通常攻撃")); //味方画像
  document.getElementById("designateskilltarget").style.visibility = "visible";
  document.getElementById("selectcommandpopupwindow").style.visibility = "visible";
});

/////////////ぼうぎょ
document.getElementById("commandguardbtn").addEventListener("click", function () {
  parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommand = "ぼうぎょ";
  finishSelectingEachMonstersCommand();
});

function startselectingcommand() {
  disablecommandbtns(true);
  //party内該当monsterのskillのn番目要素をそのまま表示
  document.getElementById("selectskillbtn0").textContent = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[0];
  document.getElementById("selectskillbtn1").textContent = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[1];
  document.getElementById("selectskillbtn2").textContent = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[2];
  document.getElementById("selectskillbtn3").textContent = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[3];
  document.getElementById("selectskillbtns").style.visibility = "visible";
  document.getElementById("selectcommandpopupwindow-text").textContent = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].name;
  document.getElementById("selectcommandpopupwindow-text").style.visibility = "visible";
  document.getElementById("selectcommandpopupwindow").style.visibility = "visible";
  //monster名表示に戻す
  //todo:inline?block?
  displayMessage("とくぎをえらんでください。");
}

function selectcommand(selectedskillnum) {
  document.getElementById("selectskillbtns").style.visibility = "hidden";
  const selectedskillname = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[selectedskillnum];
  parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommand = selectedskillname;
  //confirmedcommandに格納
  const selectedskill = findSkillByName(selectedskillname);
  const skilltargetTypedetector = selectedskill.targetType;
  const skilltargetTeamdetector = selectedskill.targetTeam;
  //nameからskill配列を検索、targetTypeとtargetTeamを引いてくる
  if (skilltargetTypedetector === "random" || skilltargetTypedetector === "single" || skilltargetTypedetector === "dead") {
    displayMessage(`${selectedskillname}＋3【消費MP：${selectedskill.MPcost} 】`);
    //randomもしくはsingleのときはtextをmonster名から指示に変更、target選択画面を表示
    document.getElementById("selectcommandpopupwindow-text").textContent = "たたかう敵モンスターをタッチしてください。";
    if (skilltargetTeamdetector === "ally") {
      document.getElementById("selectcommandpopupwindow-text").textContent = "モンスターをタッチしてください。";
    } else if (skilltargetTypedetector === "dead") {
      document.getElementById("selectcommandpopupwindow-text").textContent = "回復するモンスターをタッチしてください。";
    }
    //味方選択中かつskillのtargetTeamがenemyのとき、または敵選択中かつskillのtargetTeamがallyのとき、敵画像を代入
    //逆に味方選択中かつtargetTeamがallyのとき、または敵選択中かつtargetTeamがenemyのとき、味方画像を代入

    if ((selectingwhichteamscommand === 0 && skilltargetTeamdetector === "enemy") || (selectingwhichteamscommand === 1 && skilltargetTeamdetector === "ally")) {
      selectskilltargettoggler(1, skilltargetTypedetector, skilltargetTeamdetector, selectedskill); //敵画像
    } else {
      selectskilltargettoggler(0, skilltargetTypedetector, skilltargetTeamdetector, selectedskill); //味方画像
    }
    document.getElementById("designateskilltarget").style.visibility = "visible";
  } else if (skilltargetTypedetector === "all") {
    displayMessage(`${selectedskillname}＋3【消費MP：${selectedskill.MPcost} 】`);
    //targetがallのとき、all(yesno)画面を起動
    document.getElementById("selectcommandpopupwindow-text").style.visibility = "hidden";
    //allならmonster名は隠すのみ
    document.getElementById("designateskilltarget-all-text").textContent = selectedskillname + "を使用しますか？";
    document.getElementById("designateskilltarget-all").style.visibility = "visible";
    //parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommandtarget = "all";
    //allとかmeとか保存してもいいけど、結局skillの中身主導で動かすから不要かも
    //処理上まずはskillのtarget属性で分類、その後randomやsingleの場合はここで保存された相手に撃つ処理
  } else {
    //targetがmeのとき、そのまま終了
    document.getElementById("selectcommandpopupwindow-text").style.visibility = "hidden";
    finishSelectingEachMonstersCommand();
  }
}

function selectskilltargettoggler(targetTeamnum, skilltargetTypedetector, skilltargetTeamdetector, selectedskill) {
  //target選択、敵画像か味方画像か 通常攻撃かsingle, randomで起動
  setElementIcon("selecttargetmonster0", parties[targetTeamnum][0].id);
  setElementIcon("selecttargetmonster1", parties[targetTeamnum][1].id);
  setElementIcon("selecttargetmonster2", parties[targetTeamnum][2].id);
  setElementIcon("selecttargetmonster3", parties[targetTeamnum][3].id);
  setElementIcon("selecttargetmonster4", parties[targetTeamnum][4].id);

  // target選択用iconに対して、順番に非表示や暗転&無効化
  const excludeTarget = selectedskill.excludeTarget || null;
  for (let i = 0; i < 5; i++) {
    const targetMonsterElement = document.getElementById(`selecttargetmonster${i}`);
    const targetMonster = parties[targetTeamnum][i];
    const targetMonsterWrapper = targetMonsterElement.parentNode; // wrapper要素を取得
    //初期化で暗転&無効化解除
    toggleDarkenAndClick(targetMonsterElement, false);
    //初期化表示
    targetMonsterElement.style.display = "inline";
    targetMonsterWrapper.style.display = "flex";

    if (skilltargetTypedetector === "dead") {
      // 蘇生などdead対象のskillの場合、死亡モンスターは初期化で表示のまま、生きているモンスターは非表示
      if (!(targetMonster.flags && targetMonster.flags.isDead)) {
        targetMonsterElement.style.display = "none";
        targetMonsterWrapper.style.display = "none";
      }
    } else {
      // dead以外の通常スキルで、skilltargetTeamdetectorがenemyの場合、死亡している敵は非表示
      //skilltargetTeamdetectorがallyの場合、死亡していても非表示ではなく暗転無効化(みがわり等)
      if (targetMonster.flags && targetMonster.flags.isDead) {
        if (skilltargetTeamdetector === "enemy") {
          targetMonsterElement.style.display = "none";
          targetMonsterWrapper.style.display = "none";
        } else if (skilltargetTeamdetector === "ally") {
          toggleDarkenAndClick(targetMonsterElement, true);
        }
      }
    }

    // スキルが自分を対象外にする場合、自分の画像を暗転&無効化
    if (excludeTarget && excludeTarget === "me" && selectingwhichmonsterscommand === i) {
      toggleDarkenAndClick(targetMonsterElement, true);
    }
    //みがわりの場合、覆う中の対象を暗転&無効化
    if (selectedskill.name === "みがわり" && (targetMonster.flags.isSubstituting || targetMonster.flags.hasSubstitute)) {
      toggleDarkenAndClick(targetMonsterElement, true);
    }
  }
}

//all-yesbtnの場合、そのmonsterのコマンド選択終了
document.getElementById("designateskilltargetbtnyes").addEventListener("click", finishSelectingEachMonstersCommand);

//all-nobtn処理
document.getElementById("designateskilltargetbtnno").addEventListener("click", function () {
  document.getElementById("designateskilltarget-all").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
  disablecommandbtns(false);
  //yesno画面とpopup全体を閉じる、選択済のconfirmedcommandとtarget:allは後で新規選択されたら上書き
  displayMessage(`${parties[selectingwhichteamscommand][selectingwhichmonsterscommand].name}のこうどう`, "コマンド？");
});

//skilltarget選択画面
document.querySelectorAll(".selecttargetmonster").forEach((img) => {
  img.addEventListener("click", () => {
    const imgId = img.getAttribute("id");
    parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommandtarget = imgId.replace("selecttargetmonster", "");
    document.getElementById("designateskilltarget").style.visibility = "hidden";
    document.getElementById("selectcommandpopupwindow-text").style.visibility = "hidden";
    //テキストとtarget選択iconを閉じる
    finishSelectingEachMonstersCommand();
  });
});

//allでyes選択時、skilltarget選択後、ぼうぎょ選択、target:me選択後に起動。次のmonsterのskill選択に移行する
function finishSelectingEachMonstersCommand() {
  document.getElementById("designateskilltarget-all").style.visibility = "hidden";

  // 一時的にselectingwhichmonsterscommandを保持
  let tempSelectingMonsterIndex = selectingwhichmonsterscommand;

  // 次のモンスターの選択処理に移動
  selectingwhichmonsterscommand += 1;

  // 次の行動可能なモンスターが見つかるまでループ
  while (
    selectingwhichmonsterscommand < parties[selectingwhichteamscommand].length &&
    (isDead(parties[selectingwhichteamscommand][selectingwhichmonsterscommand]) || hasAbnormality(parties[selectingwhichteamscommand][selectingwhichmonsterscommand]))
  ) {
    // 行動不能なモンスターのconfirmedcommandを設定
    if (isDead(parties[selectingwhichteamscommand][selectingwhichmonsterscommand])) {
      parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommand = "skipThisTurn";
    } else {
      parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommand = "normalAICommand";
    }

    selectingwhichmonsterscommand += 1;
  }

  // すべてのモンスターの選択が終了したか、行動可能なモンスターが見つかった場合
  if (selectingwhichmonsterscommand >= parties[selectingwhichteamscommand].length) {
    // すべてのモンスターの選択が終了した場合
    // selectingwhichmonsterscommand を最後に選択されたモンスターに戻す
    selectingwhichmonsterscommand = tempSelectingMonsterIndex;
    askfinishselectingcommand();
  } else {
    // 行動可能なモンスターが見つかった場合
    adjustmonstericonstickout();
    displayMessage(`${parties[selectingwhichteamscommand][selectingwhichmonsterscommand].name}のこうどう`, "コマンド？");
    // スキル選択ポップアップを閉じる
    document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
    // コマンドボタンを有効化
    disablecommandbtns(false);
  }
}

// コマンド選択開始関数
function startSelectingCommandForFirstMonster(teamNum) {
  //行動不能monsterのコマンドを入れる
  parties[teamNum].forEach((monster) => {
    monster.confirmedcommand = "";
    monster.confirmedcommandtarget = "";
    if (isDead(monster)) {
      monster.confirmedcommand = "skipThisTurn";
    } else if (hasAbnormality(monster)) {
      monster.confirmedcommand = "normalAICommand";
    }
  });

  //isPartyIncapacitated  skipAllMonsterCommandSelection  adjustmonstericonstickoutにdisplaymessage

  // parties[teamNum]の先頭から、行動可能なモンスターを探す
  selectingwhichteamscommand = teamNum;
  selectingwhichmonsterscommand = 0;
  while (selectingwhichmonsterscommand < parties[teamNum].length && (isDead(parties[teamNum][selectingwhichmonsterscommand]) || hasAbnormality(parties[teamNum][selectingwhichmonsterscommand]))) {
    selectingwhichmonsterscommand++;
  }

  // 行動可能なモンスターが見つかった場合、コマンド選択画面を表示
  if (selectingwhichmonsterscommand < parties[0].length) {
    adjustmonstericonstickout();
    displayMessage(`${parties[selectingwhichteamscommand][selectingwhichmonsterscommand].name}のこうどう`, "コマンド？");
    disablecommandbtns(false);
    if (teamNum === 1) {
      //敵コマンド選択でplayerを選んだ場合用
      document.getElementById("howtoselectenemyscommand").style.visibility = "hidden";
      document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
      //アイコン反転
      preparebattlepageicons(true);
      adjustmonstericonstickout();
      //barとバフ反転
      reverseMonsterBarDisplay();
    }
  } else {
    // パーティーが全員行動不能の場合の処理
    askfinishselectingcommand();
    disablecommandbtns(true);
    document.getElementById("askfinishselectingcommandbtnno").disabled = true;
    document.getElementById("closeselectcommandpopupwindowbtn").disabled = true;
  }
}

//allのyesbtnと、skilltarget選択後に起動する場合、+=1された次のモンスターをstickout
//backbtnとpreparebattleで起動する場合、-1された相手もしくは0の状態でstickout
//一旦全削除用function、コマンド選択終了時にも起動
function removeallstickout() {
  const allmonstericonsstickout = document.querySelectorAll(".monstericon-wrapper");
  allmonstericonsstickout.forEach((monstericon) => {
    monstericon.classList.remove("stickout");
  });
}
//防御の引っ込みを消す ターン終了時に起動 死亡時は個別に削除
function removeallrecede() {
  const allmonstericonsrecede = document.querySelectorAll(".monstericon-wrapper");
  allmonstericonsrecede.forEach((monstericon) => {
    monstericon.classList.remove("recede");
  });
}
//現在選択中のmonster imgにclass:stickoutを付与
function adjustmonstericonstickout() {
  removeallstickout();
  const targetmonstericonstickout = document.getElementById(`battleiconally${selectingwhichmonsterscommand}`);
  targetmonstericonstickout.parentNode.classList.add("stickout");
}

function backbtn() {
  //preparebattleでも起動
  // 現在選択中のモンスターより前に行動可能なモンスターがいるか確認
  let previousActionableMonsterIndex = selectingwhichmonsterscommand - 1;
  while (previousActionableMonsterIndex >= 0) {
    if (!isDead(parties[selectingwhichteamscommand][previousActionableMonsterIndex]) && !hasAbnormality(parties[selectingwhichteamscommand][previousActionableMonsterIndex])) {
      // 行動可能なモンスターが見つかった場合、そのモンスターを選択
      selectingwhichmonsterscommand = previousActionableMonsterIndex;
      adjustmonstericonstickout();
      displayMessage(`${parties[selectingwhichteamscommand][selectingwhichmonsterscommand].name}のこうどう`, "コマンド？");
      return;
    }
    previousActionableMonsterIndex--;
  }
}

//全て閉じてcommandbtnを有効化する関数
function closeSelectCommandPopupWindowContents() {
  document.getElementById("designateskilltarget").style.visibility = "hidden";
  document.getElementById("designateskilltarget-all").style.visibility = "hidden";
  document.getElementById("selectskillbtns").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow-text").style.visibility = "hidden";
  document.getElementById("askfinishselectingcommand").style.visibility = "hidden";
  document.getElementById("howtoselectenemyscommand").style.visibility = "hidden";
  disablecommandbtns(false);
  displayMessage(`${parties[selectingwhichteamscommand][selectingwhichmonsterscommand].name}のこうどう`, "コマンド？");
}

// 閉じるボタンにイベントリスナー追加
document.getElementById("closeselectcommandpopupwindowbtn").addEventListener("click", closeSelectCommandPopupWindowContents);

function disablecommandbtns(trueorfalse) {
  document.querySelectorAll(".commandbtn").forEach((button) => {
    button.disabled = trueorfalse;
    if (trueorfalse) {
      button.style.opacity = "0.2";
    } else {
      button.style.opacity = "";
    }
  });
}

//コマンド選択を終了しますか
function askfinishselectingcommand() {
  document.getElementById("askfinishselectingcommand").style.visibility = "visible";
  document.getElementById("selectcommandpopupwindow").style.visibility = "visible"; //最後が防御の場合に枠を新規表示
  displayMessage("モンスターたちはやる気だ！");
}

//コマンド選択終了画面でno選択時、yesno選択画面とpopup全体を閉じて5体目コマンド選択前に戻す
document.getElementById("askfinishselectingcommandbtnno").addEventListener("click", function () {
  document.getElementById("askfinishselectingcommand").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
  disablecommandbtns(false);

  // 最後尾の行動可能なモンスターのインデックスを取得
  selectingwhichmonsterscommand = parties[selectingwhichteamscommand].length - 1;
  while (
    selectingwhichmonsterscommand >= 0 &&
    (isDead(parties[selectingwhichteamscommand][selectingwhichmonsterscommand]) || hasAbnormality(parties[selectingwhichteamscommand][selectingwhichmonsterscommand]))
  ) {
    selectingwhichmonsterscommand--;
  }

  // 選択中のモンスターを強調表示
  adjustmonstericonstickout();
  displayMessage(`${parties[selectingwhichteamscommand][selectingwhichmonsterscommand].name}のこうどう`, "コマンド？");
});

//コマンド選択終了画面でyes選択時、コマンド選択を終了
document.getElementById("askfinishselectingcommandbtnyes").addEventListener("click", function () {
  document.getElementById("askfinishselectingcommandbtnno").disabled = false;
  document.getElementById("closeselectcommandpopupwindowbtn").disabled = false;
  //全員選択不能の場合のdisable化解除
  document.getElementById("askfinishselectingcommand").style.visibility = "hidden";
  if (selectingwhichteamscommand == "1") {
    //敵も選択終了後は、startbattleへ
    selectingwhichmonsterscommand = 0;
    selectingwhichteamscommand = 0;
    //初期化
    document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
    disablecommandbtns(true);
    //popupを閉じ、commandbtnsを無効化
    preparebattlepageicons();
    //barとバフの反転を戻す
    restoreMonsterBarDisplay();
    removeallstickout();
    startbattle();
  } else {
    //味方選択のみ終了時はyesno選択画面を閉じ、敵のコマンド選択方法選択画面を表示
    document.getElementById("howtoselectenemyscommand").style.visibility = "visible";
  }
});

//敵のコマンド選択方法-player
document.getElementById("howtoselectenemyscommandbtn-player").addEventListener("click", function () {
  startSelectingCommandForFirstMonster(1);
});

//敵のコマンド選択方法-improvedAI
document.getElementById("howtoselectenemyscommandbtn-improvedAI").addEventListener("click", function () {
  selectingwhichmonsterscommand = 0;
  selectingwhichteamscommand = 1;
  document.getElementById("howtoselectenemyscommand").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
});
//敵のコマンド選択方法-takoAI
document.getElementById("howtoselectenemyscommandbtn-takoAI").addEventListener("click", function () {
  selectingwhichmonsterscommand = 0;
  selectingwhichteamscommand = 1;
  document.getElementById("howtoselectenemyscommand").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
});
//ここは最大ダメージ検知AIなども含めて統合処理

//ターン開始時処理、毎ラウンド移行時とpreparebattleから起動
function startTurn() {
  fieldState.turnNum++;
  const turnNum = fieldState.turnNum;
  displayMessage(`ラウンド${turnNum}`, null, true);
  //modifiedSpeed生成 ラウンド開始時に毎ターン起動 行動順生成はコマンド選択後
  for (const party of parties) {
    for (const monster of party) {
      monster.modifiedSpeed = calculateModifiedSpeed(monster);
    }
  }
  // ぼうぎょタグを削除
  removeallrecede();

  //覆い隠す以外の身代わりflagとぼうぎょ削除
  for (const party of parties) {
    for (const monster of party) {
      delete monster.flags.guard;
      if (monster.flags.isSubstituting && !monster.flags.isSubstituting.cover) {
        delete monster.flags.isSubstituting;
      }
      if (monster.flags.hasSubstitute && !monster.flags.hasSubstitute.cover) {
        delete monster.flags.hasSubstitute;
      }
    }
  }

  //ターン経過で一律にデクリメントタイプの実行 バフ付与前に
  decreaseAllBuffDurations();
  //durationが0になったバフを消去 ターン開始時に削除(帝王の構えや予測等、removeAtTurnStart指定)
  removeExpiredBuffsAtTurnStart();

  // バフ対象の種類
  const BuffTargetType = {
    Self: "self",
    Ally: "ally",
    Enemy: "enemy",
    All: "all",
    Random: "random",
  };
  // monster.attributeに含まれるもののうちturnNumに等しいものをbuffに入れる
  for (const party of parties) {
    for (const monster of party) {
      if (monster.flags.isDead) {
        continue;
      }
      // バフを適用する関数
      const applyBuffs = (buffs) => {
        for (const buffName in buffs) {
          const buffData = buffs[buffName];

          // バフ対象の取得
          const targetType = buffData.targetType || BuffTargetType.Self; // デフォルトは自分自身

          // バフ対象に応じた処理
          switch (targetType) {
            case BuffTargetType.Self:
              applyBuff(monster, { [buffName]: structuredClone(buffData) });
              break;
            case BuffTargetType.Ally:
              for (const ally of party) {
                if (!ally.flags.isDead) {
                  //自分除外時はally !== monster &&
                  applyBuff(ally, { [buffName]: structuredClone(buffData) });
                }
              }
              break;
            case BuffTargetType.Enemy:
              const enemyParty = parties.find((p) => p !== party);
              for (const enemy of enemyParty) {
                if (!enemy.flags.isDead) {
                  applyBuff(enemy, { [buffName]: structuredClone(buffData) });
                }
              }
              break;
            case BuffTargetType.All:
              for (const allMonster of parties.flat()) {
                if (!allMonster.flags.isDead) {
                  applyBuff(allMonster, { [buffName]: structuredClone(buffData) });
                }
              }
              break;
            case BuffTargetType.Random:
              const aliveMonsters = (buffData.targetTeam === "ally" ? party : parties[monster.enemyTeamID]).filter((monster) => !monster.flags.isDead);
              const targetNum = buffData.targetNum || 1; // targetNumが指定されていない場合は1回

              for (let i = 0; i < targetNum; i++) {
                if (aliveMonsters.length > 0) {
                  const randomIndex = Math.floor(Math.random() * aliveMonsters.length);
                  const randomTarget = aliveMonsters[randomIndex];
                  applyBuff(randomTarget, { [buffName]: structuredClone(buffData) });
                  // 重複は許可
                  //aliveMonsters.splice(randomIndex, 1);
                }
              }
              break;
          }
        }
      };

      // すべてのバフをまとめる
      const allBuffs = {
        ...(monster.attribute[turnNum] || {}),
        ...(monster.attribute.permanentBuffs || {}),
        ...(turnNum % 2 === 0 && monster.attribute.evenTurnBuffs ? monster.attribute.evenTurnBuffs : {}),
        ...(turnNum % 2 !== 0 && monster.attribute.oddTurnBuffs ? monster.attribute.oddTurnBuffs : {}),
      };

      // allBuffs を applyBuffs に渡す
      applyBuffs(allBuffs);
    }
  }
  //コマンド選択の用意 Todo:実際は開始時特性等の演出終了後に実行
  closeSelectCommandPopupWindowContents();
  startSelectingCommandForFirstMonster(0);
}

//毎ラウンドコマンド選択後処理
async function startbattle() {
  await sleep(1000);
  //1round目なら戦闘開始時flagを持つ特性等を発動
  //ラウンド開始時flagを持つ特性を発動 多分awaitする
  decideTurnOrder(parties, skill);
  //monsterの行動を順次実行
  for (const monster of turnOrder) {
    await processMonsterAction(monster, findSkillByName(monster.confirmedcommand));
    await sleep(750);
  }
  startTurn();
}

// バフ追加用関数
function applyBuff(buffTarget, newBuff, skillUser = null, isReflection = false) {
  for (const buffName in newBuff) {
    const currentBuff = buffTarget.buffs[buffName];
    const buffData = newBuff[buffName];

    // 重ねがけ可能なバフ
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
    };

    const abnormalityBuffs = ["spellSeal", "breathSeal", "slashSeal", "martialSeal", "fear", "tempted", "sealed", "confused", "paralyzed", "asleep", "poisoned", "dazzle"];
    const removeGuardAbnormalities = ["tempted", "sealed", "confused", "paralyzed", "asleep"];
    const mindAndSealBarrierTargets = ["spellSeal", "breathSeal", "slashSeal", "martialSeal", "fear", "tempted"];
    const dispellableByRadiantWaveAbnormalities = [
      "spellSeal",
      "breathSeal",
      "slashSeal",
      "martialSeal",
      "fear",
      "tempted",
      "sealed",
      "confused",
      "paralyzed",
      "asleep",
      "poisoned",
      "dazzle",
      "reviveBlock",
      "dotDamage",
      "healBlock",
      "maso",
    ];

    // statusLock が存在する場合は stackableBuffs と familyBuff を付与しない
    if (buffTarget.buffs.statusLock && (stackableBuffs.hasOwnProperty(buffName) || (newBuff[buffName] && newBuff[buffName].hasOwnProperty("type") && newBuff[buffName].type === "familyBuff"))) {
      continue;
    }

    // buffData 内に probability が存在するかチェック
    const probability = buffData.probability !== undefined ? buffData.probability : 10;
    // 確率格納後にprobability を削除
    delete buffData.probability;

    // 耐性バフ、状態異常、その他の順で独立して確率判定処理、付与失敗時はcontinueで次へ飛ばす
    // 1. 耐性ダウンの場合のみ耐性をかけて処理
    if (resistanceBuffElementMap.hasOwnProperty(buffName) && buffData.strength < 0) {
      const buffElement = resistanceBuffElementMap[buffName];
      const resistance = calculateResistance(null, buffElement, buffTarget, fieldState.isDistorted);

      if (resistance > 0) {
        // 現在の耐性が無効未満の場合のみ耐性ダウンを適用
        // 確率を調整
        const adjustedProbability = probability * resistance;
        // 確率に基づいてバフ適用を判定
        if (Math.random() > adjustedProbability) {
          continue; // 確率でバフ適用しない場合は次のバフへ
        }
      } else {
        // 現在の耐性が 0 以下の場合は適用しない
        continue; // 次のバフへ
      }
    } else if (abnormalityBuffs.includes(buffName)) {
      //2. 状態異常系のうち、耐性が存在して防壁系バフで防がれるタイプの特殊処理 (蘇生・回復封じ・継続ダメ・マソ以外)
      //防壁や魔王バリアで防ぐ
      if (buffTarget.buffs.sacredBarrier || buffTarget.buffs.demonKingBarrier) {
        continue;
      }
      //マインド封じ無効
      if (buffTarget.buffs.mindAndSealBarrier && mindAndSealBarrierTargets.includes(buffName)) {
        continue;
      }
      //マインドバリア
      if ((buffName === "fear" || buffName === "tempted") && buffTarget.buffs.mindBarrier) {
        continue;
      }
      //眠りバリア
      if (buffName === "asleep" && buffTarget.buffs.sleepBarrier) {
        continue;
      }
      //混乱バリア
      if (buffName === "confused" && buffTarget.buffs.confusionBarrier) {
        continue;
      }
      //既にほかの行動停止系状態異常にかかっている場合はfear, tempted, sealedはかけない ただし封印によるマインド上書きは例外
      if (buffTarget.buffs.fear && buffName === "sealed") {
      } else if ((buffName === "fear" || buffName === "tempted" || buffName === "sealed") && hasAbnormality(buffTarget)) {
        continue;
      }
      //耐性を参照して確率判定
      let abnormalityResistance = 1;
      //氷の王国処理
      if (buffName === "sealed" && buffData.element) {
        abnormalityResistance = calculateResistance(skillUser, buffData.element, buffTarget);
        if (abnormalityResistance < 0.6) {
          abnormalityResistance = -1;
        }
      } else {
        //状態異常系かつ反射の場合は逆転 反射によって逆転されているのを戻し、元々の使用者とtargetの耐性および使い手で判定
        if (isReflection) {
          abnormalityResistance = calculateResistance(buffTarget, buffName, skillUser);
        } else {
          abnormalityResistance = calculateResistance(skillUser, buffName, buffTarget);
        }
      }
      if (Math.random() > probability * abnormalityResistance) {
        continue;
      }
      //状態異常の確率判定成功時処理

      //ここでもう上書き処理を実行
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
      //ぼうぎょ解除
      if (removeGuardAbnormalities.includes(buffName) && buffTarget.flags.guard) {
        delete buffTarget.flags.guard;
      }
      //魅了による防御バフ解除
      if (buffName === "tempted") {
        delete buffTarget.buffs.defUp;
      }
      //みがわり解除
      if ((removeGuardAbnormalities.includes(buffName) || buffName === "fear") && buffTarget.flags.isSubstituting && !buffTarget.flags.isSubstituting.cover) {
        for (const eachMonster of parties.flat()) {
          if (eachMonster.flags.hasSubstitute && eachMonster.flags.hasSubstitute.targetMonsterId === buffTarget.monsterId) {
            delete eachMonster.flags.hasSubstitute;
          }
        }
        delete buffTarget.flags.isSubstituting;
      }
    } else {
      // 3. Resistance系バフと状態異常以外の場合の確率判定
      if (Math.random() > probability) {
        continue;
      }
    }

    //光の波動で解除可能なフラグを付与 解除不可毒や回復封じを除く
    //もし同種状態異常で、かつ既存のバフがundispellable > 新規付与がdispellable の場合は上書きしない
    //上の上書き処理を事前に行うことはあまり望ましくないが、競合するバフなどのため特に問題は起きない
    if (dispellableByRadiantWaveAbnormalities.includes(buffName) && !buffData.unDispellableByRadiantWave) {
      buffData.dispellableByRadiantWave = true;
    }
    if (currentBuff && currentBuff.unDispellableByRadiantWave && buffData.dispellableByRadiantWave) {
      continue;
    }

    //バフ適用処理の前に、競合処理の共通部分
    //2. keepOnDeath > unDispellable > divineDispellable > else の順位付けで負けてるときはcontinue (イブール上位リザオ、黄泉の封印vs普通、つねバイキ、トリリオン、ネル行動前バフ)
    if (currentBuff) {
      function getBuffPriority(buff) {
        if (buff.keepOnDeath) return 3;
        if (buff.unDispellable) return 2;
        if (buff.divineDispellable) return 1;
        return 0;
      }
      const currentBuffPriority = getBuffPriority(currentBuff);
      const newBuffPriority = getBuffPriority(buffData);
      // currentBuffの方が優先度が高い場合はcontinue
      if (currentBuffPriority > newBuffPriority) {
        continue;
      }
    }

    // 確率判定成功時にバフ適用処理
    if (stackableBuffs.hasOwnProperty(buffName)) {
      // 重ねがけ可能なバフ
      if (currentBuff) {
        // 重ねがけ可能かつ既にバフが存在する場合はstrength を加算 (上限と下限をチェック)
        const newStrength = Math.max(stackableBuffs[buffName].min, Math.min(currentBuff.strength + buffData.strength, stackableBuffs[buffName].max));
        if (newStrength === 0) {
          // strength が 0 になったらバフを削除
          delete buffTarget.buffs[buffName];
          continue;
        } else {
          // 0以外の場合はstrengthだけ加算して新しいバフで上書き
          buffTarget.buffs[buffName] = { ...currentBuff, strength: newStrength };
        }
      } else {
        // 重ねがけ可能かつ既に存在しない場合はそのまま適用
        buffTarget.buffs[buffName] = { ...buffData };
      }
      //重ねがけ可能の付与成功
    } else {
      // 重ねがけ不可のバフの場合、基本は上書き 競合によって上書きしない場合のみ以下のcontinueで弾く
      if (currentBuff) {
        //1. currentbuffにremoveAtTurnStartがあり、newbuffにないときはcontinue (予測系は上書きしない)
        if (currentBuff.removeAtTurnStart && !buffData.removeAtTurnStart) {
          continue;
        }
        //2. keepOnDeath > unDispellable > divineDispellable > else の順位付けで負けてるときはcontinue (イブール上位リザオや、黄泉の封印vs普通)
        //これは重ねがけ可能なバフも含めて実行
        //3. currentbuffにdurationが存在せず、かつbuffDataにdurationが存在するときはcontinue (常にマホカンは上書きしない)
        if (!currentBuff.duration && buffData.duration) {
          continue;
        }
        //4. strengthが両方存在し、かつ負けてるときはcontinue (strengthで比較する系：力ため、系統バフ、反射、prot、使い手付与で負けてたら上書きしない)
        if (currentBuff.strength && buffData.strength && currentBuff.strength > buffData.strength) {
          continue;
        }
      }
      buffTarget.buffs[buffName] = { ...buffData };
      //重ねがけ不可の付与成功
      // ここでもしstatusLockを付与した場合は 既存のstackableBuffs と familyBuff を削除
      if (buffName === "statusLock") {
        const buffNames = Object.keys(buffTarget.buffs);
        for (const existingBuffName of buffNames) {
          if (stackableBuffs.hasOwnProperty(existingBuffName) || (buffTarget.buffs[existingBuffName] && buffTarget.buffs[existingBuffName].type === "familyBuff")) {
            delete buffTarget.buffs[existingBuffName];
          }
        }
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
      reviveBlock: {
        100: 1,
      },
      preemptiveAction: {
        100: 1,
      },
      anchorAction: {
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
    //duration表に含まれるバフかつduration未指定の場合のみduration更新 (力ため等は自動設定だが、侵食(3)などduration設定時は自動設定しない)
    if (buffName in buffDurations && !buffData.hasOwnProperty("duration")) {
      buffTarget.buffs[buffName].duration = getDuration(buffName);
    }
    // ターン経過で減少するバフのリスト
    const decreaseTurnEnd = ["skillTurn", "hogeReflection"];
    //ターン最初に解除するバフのリスト 反射以外 これとstackableは自動的にdecreaseTurnEndを付与
    const removeAtTurnStartBuffs = ["reviveBlock", "preemptiveAction", "anchorAction"];

    if (removeAtTurnStartBuffs.includes(buffName)) {
      buffTarget.buffs[buffName].removeAtTurnStart = true;
    }

    //継続時間指定されている場合に、デクリメントのタイプを設定
    if (buffTarget.buffs[buffName].duration) {
      // stackableBuffs または decreaseTurnEnd または removeAtTurnStartを所持 (初期設定or removeAtTurnStartBuffsに含まれる) 場合
      if (buffName in stackableBuffs || decreaseTurnEnd.includes(buffName) || buffTarget.buffs[buffName].removeAtTurnStart) {
        //ターン経過で一律にデクリメントするタイプを設定
        buffTarget.buffs[buffName].decreaseTurnEnd = true;
      } else {
        //それ以外は行動後にデクリメント
        buffTarget.buffs[buffName].decreaseBeforeAction = true;
      }
    }

    //状態異常によるduration1の構え系解除
    const reflectionMap = ["spellReflection", "slashReflection", "martialReflection", "breathReflection", "danceReflection", "ritualReflection"];
    if (removeGuardAbnormalities.includes(buffName) || buffName === "fear") {
      for (const reflection of reflectionMap) {
        if (buffTarget.buffs[reflection] && !buffTarget.buffs[reflection].keepOnDeath && buffTarget.buffs[reflection].removeAtTurnStart && buffTarget.buffs[reflection].duration === 1) {
          delete buffTarget.buffs[reflection];
        }
      }
    }
    //反射の場合にエフェクト追加
    if (reflectionMap.includes(buffName)) {
      addMirrorEffect(buffTarget.iconElementId);
    }
  }
  updateCurrentStatus(buffTarget); // バフ全て追加後に該当monsterのcurrentstatusを更新
  updateMonsterBuffsDisplay(buffTarget);
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
function removeExpiredBuffs(monster) {
  for (const buffName of Object.keys(monster.buffs)) {
    const buff = monster.buffs[buffName];
    // duration プロパティが存在し、かつ 0 以下で、removeAtTurnStartがfalseの場合に削除
    if (buff.hasOwnProperty("duration") && buff.duration <= 0 && !buff.removeAtTurnStart) {
      delete monster.buffs[buffName];
    }
  }
  updateCurrentStatus(monster);
  updateMonsterBuffsDisplay(monster);
}

// durationが0になったバフを消去 ターン開始時(帝王の構えや予測等、removeAtTurnStart指定)
function removeExpiredBuffsAtTurnStart() {
  for (const party of parties) {
    for (const monster of party) {
      for (const buffName of Object.keys(monster.buffs)) {
        const buff = monster.buffs[buffName];
        // duration プロパティが存在し、かつ 0 以下で、removeAtTurnStartがtrueの場合に削除
        if (buff.hasOwnProperty("duration") && buff.duration <= 0 && buff.removeAtTurnStart) {
          delete monster.buffs[buffName];
        }
      }
      updateCurrentStatus(monster);
      updateMonsterBuffsDisplay(monster);
    }
  }
}

// currentstatusを更新する関数
// applyBuffの追加時および持続時間切れ、解除時に起動
function updateCurrentStatus(monster) {
  // currentstatus を defaultstatus の値で初期化
  monster.currentstatus.atk = monster.defaultstatus.atk;
  monster.currentstatus.def = monster.defaultstatus.def;
  monster.currentstatus.spd = monster.defaultstatus.spd;
  monster.currentstatus.int = monster.defaultstatus.int;

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

  if (monster.buffs.defUp) {
    const strengthKey = monster.buffs.defUp.strength + 2;
    const Multiplier = strengthMultipliersForDef[strengthKey];
    monster.currentstatus.def *= Multiplier;
  }
  if (monster.buffs.spdUp) {
    const strengthKey = monster.buffs.spdUp.strength + 2;
    const Multiplier = strengthMultipliersForSpdInt[strengthKey];
    monster.currentstatus.spd *= Multiplier;
  }
  if (monster.buffs.intUp) {
    const strengthKey = monster.buffs.intUp.strength + 2;
    const Multiplier = strengthMultipliersForSpdInt[strengthKey];
    monster.currentstatus.int *= Multiplier;
  }

  //系統バフは直接strengthをかける
  //TODO: 内部バフの実装
}

// 行動順を決定する関数 コマンド決定後にstartbattleで起動
let turnOrder = [];
function decideTurnOrder(parties, skills) {
  // 全てのモンスターを1つの配列にまとめる
  let allMonsters = parties.flat();

  // 各行動順のモンスターを格納する配列を定義
  let preemptiveMonsters = [];
  let preemptiveActionMonsters = [];
  let anchorMonsters = [];
  let anchorActionMonsters = [];
  let normalMonsters = [];

  // 各モンスターの行動順を分類 (skillのorderと特性の複数所持時はskillのorder優先で分類)
  allMonsters.forEach((monster) => {
    const confirmedSkilldetector = skills.find((skill) => skill.name === monster.confirmedcommand);

    if (confirmedSkilldetector?.order === "preemptive") {
      preemptiveMonsters.push(monster);
    } else if (confirmedSkilldetector?.order === "anchor") {
      anchorMonsters.push(monster);
    } else if (monster.buffs.preemptiveAction) {
      preemptiveActionMonsters.push(monster);
    } else if (monster.buffs.anchorAction) {
      anchorActionMonsters.push(monster);
    } else {
      normalMonsters.push(monster);
    }
  });

  // 行動順を決定
  turnOrder = [];
  //初期化

  if ("isReverse" in fieldState && fieldState.isReverse === true) {
    // --- リバース状態の処理 ---
    // 各グループのソート処理を関数化
    const sortByPreemptiveGroupAndSpeed = (a, b) => {
      const skillA = skills.find((skill) => skill.name === a.confirmedcommand);
      const skillB = skills.find((skill) => skill.name === b.confirmedcommand);
      if (skillA?.preemptivegroup !== skillB?.preemptivegroup) {
        return skillA?.preemptivegroup - skillB?.preemptivegroup;
      } else {
        return a.modifiedSpeed - b.modifiedSpeed;
      }
    };

    // 1. preemptivegroup 1-6 を追加 (preemptivegroupの小さい順、modifiedSpeedの遅い順)
    turnOrder.push(
      ...allMonsters
        .filter((monster) => {
          const skill = skills.find((s) => s.name === monster.confirmedcommand);
          return skill && skill.preemptivegroup >= 1 && skill.preemptivegroup <= 6;
        })
        .sort(sortByPreemptiveGroupAndSpeed)
    );

    // 2. アンカー技を使うモンスターを追加 (anchorAction所持, 特性未所持, preemptiveAction所持の順、
    //    各グループ内ではmodifiedSpeedの遅い順)
    turnOrder.push(
      ...anchorMonsters.filter((monster) => monster.buffs.anchorAction).sort((a, b) => (a?.currentstatus?.spd || 0) - (b?.currentstatus?.spd || 0)),
      ...anchorMonsters.filter((monster) => !monster.buffs.anchorAction && !monster.buffs.preemptiveAction).sort((a, b) => a.modifiedSpeed - b.modifiedSpeed),
      ...anchorMonsters.filter((monster) => monster.buffs.preemptiveAction).sort((a, b) => (a?.currentstatus?.spd || 0) - (b?.currentstatus?.spd || 0))
    );

    // 3. anchorActionを持つモンスターを追加 (currentstatus.spdの遅い順)
    turnOrder.push(...anchorActionMonsters.sort((a, b) => (a?.currentstatus?.spd || 0) - (b?.currentstatus?.spd || 0)));

    // 4. 通常の行動順のモンスターを追加 (modifiedSpeedの遅い順)
    turnOrder.push(...normalMonsters.sort((a, b) => a.modifiedSpeed - b.modifiedSpeed));

    // 5. preemptiveActionを持つモンスターを追加 (currentstatus.spdの遅い順)
    turnOrder.push(...preemptiveActionMonsters.sort((a, b) => (a?.currentstatus?.spd || 0) - (b?.currentstatus?.spd || 0)));

    // 6. preemptivegroup 7-8 を追加 (preemptivegroupの小さい順、modifiedSpeedの遅い順)
    turnOrder.push(
      ...allMonsters
        .filter((monster) => {
          const skill = skills.find((s) => s.name === monster.confirmedcommand);
          return skill && skill.preemptivegroup >= 7 && skill.preemptivegroup <= 8;
        })
        .sort(sortByPreemptiveGroupAndSpeed)
    );
  } else {
    // --- 通常状態の処理 ---
    // 各グループのソート処理を関数化
    const sortByPreemptiveGroupAndReverseSpeed = (a, b) => {
      const skillA = skills.find((skill) => skill.name === a.confirmedcommand);
      const skillB = skills.find((skill) => skill.name === b.confirmedcommand);
      if (skillA?.preemptivegroup !== skillB?.preemptivegroup) {
        return skillA?.preemptivegroup - skillB?.preemptivegroup;
      } else {
        return b.modifiedSpeed - a.modifiedSpeed;
      }
    };

    // 1. preemptivegroup 1-5 を追加 (preemptivegroupの小さい順、modifiedSpeedの遅い順)
    turnOrder.push(
      ...allMonsters
        .filter((monster) => {
          const skill = skills.find((s) => s.name === monster.confirmedcommand);
          return skill && skill.preemptivegroup >= 1 && skill.preemptivegroup <= 6;
        })
        .sort(sortByPreemptiveGroupAndReverseSpeed)
    );

    // 2. preemptivegroup 7-8 を追加 (preemptivegroupの小さい順、modifiedSpeedの遅い順)
    turnOrder.push(
      ...allMonsters
        .filter((monster) => {
          const skill = skills.find((s) => s.name === monster.confirmedcommand);
          return skill && skill.preemptivegroup >= 7 && skill.preemptivegroup <= 8;
        })
        .sort(sortByPreemptiveGroupAndReverseSpeed)
    );

    // 3. preemptiveActionを持つモンスターを追加 (currentstatus.spdの遅い順)
    turnOrder.push(...preemptiveActionMonsters.sort((a, b) => (b?.currentstatus?.spd || 0) - (a?.currentstatus?.spd || 0)));

    // 4. 通常の行動順のモンスターを追加 (modifiedSpeedの遅い順)
    turnOrder.push(...normalMonsters.sort((a, b) => b.modifiedSpeed - a.modifiedSpeed));

    // 5. anchorActionを持つモンスターを追加 (currentstatus.spdの遅い順)
    turnOrder.push(...anchorActionMonsters.sort((a, b) => (b?.currentstatus?.spd || 0) - (a?.currentstatus?.spd || 0)));

    // 6. アンカー技を使うモンスターを追加 (preemptiveAction持ち-> 通常行動 -> anchorAction持ち)
    turnOrder.push(
      ...anchorMonsters.filter((monster) => monster.buffs.preemptiveAction).sort((a, b) => (b?.currentstatus?.spd || 0) - (a?.currentstatus?.spd || 0)),
      ...anchorMonsters.filter((monster) => !monster.buffs.anchorAction && !monster.buffs.preemptiveAction).sort((a, b) => b.modifiedSpeed - a.modifiedSpeed),
      ...anchorMonsters.filter((monster) => monster.buffs.anchorAction).sort((a, b) => (b?.currentstatus?.spd || 0) - (a?.currentstatus?.spd || 0))
    );
  }

  console.log(turnOrder);
  return turnOrder;
}

// SPDに乱数をかけた補正値を計算する関数 蘇生時にも使うかも
function calculateModifiedSpeed(monster) {
  const randomMultiplier = 0.975 + Math.random() * 0.05;
  return monster.currentstatus.spd * randomMultiplier;
}

// 各monsterの行動を実行する関数
async function processMonsterAction(skillUser, executingSkill, executedSkills = [], isFollowingSkill = false) {
  // 全てのモンスターの isRecentlyDamaged フラグを削除
  for (const party of parties) {
    for (const monster of party) {
      delete monster.flags.isRecentlyDamaged;
    }
  }

  // 1. 死亡確認
  if (skillUser.confirmedcommand === "skipThisTurn") {
    return; // 行動前に一回でも死んでいたら処理をスキップ
  }

  removeallstickout();
  if (executingSkill.name === "ぼうぎょ") {
    document.getElementById(skillUser.iconElementId).parentNode.classList.add("recede");
  } else {
    document.getElementById(skillUser.iconElementId).parentNode.classList.add("stickout");
  }

  // 2. バフ状態異常継続時間確認
  if (!isFollowingSkill) {
    // 行動直前に持続時間を減少させる decreaseBeforeAction
    decreaseBuffDurationBeforeAction(skillUser);
    // durationが0になったバフを消去 行動直前に削除(通常タイプ)
    removeExpiredBuffs(skillUser);
  }

  // 3. 状態異常確認
  if (hasAbnormality(skillUser) && !executingSkill.skipAbnormalityCheck) {
    // 状態異常の場合は7. 行動後処理にスキップ
    console.log(`${skillUser.name}は状態異常`);
    await postActionProcess(skillUser, executingSkill, executedSkills);
    return;
  }

  // 4. 特技封じ確認
  const sealTypes = ["spell", "breath", "slash", "martial"];
  if (sealTypes.some((sealType) => executingSkill.type === sealType && skillUser.buffs[sealType + "Seal"] && !executingSkill.skipSkillSealCheck)) {
    // 特技封じされている場合は7. 行動後処理にスキップ
    console.log(`${skillUser.name}はとくぎを封じられている！`);
    await postActionProcess(skillUser, executingSkill, executedSkills);
    return;
  }

  // 5. 消費MP確認
  if (!isFollowingSkill) {
    if (executingSkill.MPcost === "all") {
      skillUser.currentstatus.MP = 0;
    } else if (skillUser.currentstatus.MP >= executingSkill.MPcost) {
      skillUser.currentstatus.MP -= executingSkill.MPcost;
      updateMonsterBar(skillUser);
    } else {
      console.log(skillUser.currentstatus.MP);
      console.log(executingSkill.MPcost);
      console.log("しかし、MPが足りなかった！");
      displayMessage("しかし、MPが足りなかった！");
      // MP不足の場合は7. 行動後処理にスキップ
      await postActionProcess(skillUser, executingSkill, executedSkills);
      return;
    }
  }

  // 6. スキル実行処理
  console.log(`${skillUser.name}は${executingSkill.name}を使った！`);
  if (!isFollowingSkill) {
    displayMessage(`${skillUser.name}の`, `${executingSkill.name}！`);
  }
  const skillTargetTeam = executingSkill.targetTeam === "ally" ? parties[skillUser.teamID] : parties[skillUser.enemyTeamID];
  await sleep(40); // スキル実行前に待機時間を設ける
  if (skillUser.confirmedcommandtarget === "") {
    await executeSkill(skillUser, executingSkill);
  } else {
    await executeSkill(skillUser, executingSkill, skillTargetTeam[parseInt(skillUser.confirmedcommandtarget, 10)]);
  }

  // 7. 行動後処理
  // 実行済みスキルを配列末尾に追加
  executedSkills.push(executingSkill);
  await postActionProcess(skillUser, executingSkill, executedSkills);
}

// 行動後処理
async function postActionProcess(skillUser, executingSkill, executedSkills) {
  // 7-1. followingSkill判定処理
  if (executingSkill.followingSkill && !(skillUser.confirmedcommand === "skipThisTurn" && !executingSkill.skipDeathCheck)) {
    // "skipThisTurn" ではない または skipDeathCheck が存在するときに実行
    await sleep(350);
    await processMonsterAction(skillUser, findSkillByName(executingSkill.followingSkill), [...executedSkills], true); // スキル実行履歴を引き継ぐ
    return; // followingSkillを実行した場合は以降の処理はスキップ
  }

  // 7-2. flag付与
  skillUser.flags.hasActedThisTurn = true;
  if (executingSkill.type !== "notskill") {
    skillUser.flags.hasUsedSkillThisTurn = true;
  }

  // 7-3. AI追撃処理
  if (!skillUser.flags.hasDiedThisAction && skillUser.AINormalAttack) {
    const originalSkill = executedSkills.length > 0 ? executedSkills[0] : executingSkill;
    const noAIskills = ["黄泉の封印", "神獣の封印"];
    if (
      !isDead(skillUser) &&
      !hasAbnormality(skillUser) &&
      skillUser.AINormalAttack &&
      !noAIskills.includes(executingSkill.name) &&
      !(originalSkill.howToCalculate === "none" && (originalSkill.order === "preemptive" || originalSkill.order === "anchor"))
    ) {
      await sleep(300);
      let attackTimes =
        skillUser.AINormalAttack.length === 1
          ? skillUser.AINormalAttack[0] - 1
          : Math.floor(Math.random() * (skillUser.AINormalAttack[1] - skillUser.AINormalAttack[0] + 1)) + skillUser.AINormalAttack[0] - 1;
      if (skillUser.buffs.aiExtraAttacks) {
        attackTimes += skillUser.buffs.aiExtraAttacks.strength;
      }
      for (let i = 0; i < attackTimes; i++) {
        await sleep(530); // 追撃ごとに待機時間
        console.log(`${skillUser.name}は通常攻撃で追撃！`);
        displayMessage(`${skillUser.name}の攻撃！`);
        // 通常攻撃を実行
        await executeSkill(skillUser, findSkillByName("通常攻撃"), decideNormalAttackTarget(skillUser));
      }
    }
  }

  // 7-4. 行動後発動特性の処理
  if (!skillUser.flags.hasDiedThisAction) {
    for (const ability of Object.values(skillUser.abilities)) {
      if (ability.trigger === "afterAction" && typeof ability.act === "function") {
        await ability.act(skillUser, executingSkill, executedSkills);
        await sleep(400); // 特性発動ごとに待機時間を設ける
      }
    }
  }

  // 7-5. 属性断罪の刻印処理
  if (!skillUser.flags.hasDiedThisAction) {
    if (skillUser.buffs.elementalRetributionMark && executedSkills.some((skill) => skill && skill.element !== "none")) {
      const damage = Math.floor(skillUser.defaultstatus.HP * 0.7);
      console.log(`${skillUser.name}は属性断罪の刻印で${damage}のダメージを受けた！`);
      applyDamage(skillUser, damage);
      await sleep(400); // 属性断罪の刻印処理後に待機時間を設ける
    }
  }

  // 7-6. 毒・継続ダメージ処理
  if (!skillUser.flags.hasDiedThisAction) {
    if (skillUser.buffs.poisoned) {
      const poisonDepth = skillUser.buffs.poisonDepth?.strength ?? 1;
      const damage = Math.floor(skillUser.defaultstatus.HP * skillUser.buffs.poisoned.strength * poisonDepth);
      console.log(`${skillUser.name}は毒で${damage}のダメージを受けた！`);
      applyDamage(skillUser, damage);
      await sleep(400); // 毒ダメージ処理後に待機時間を設ける
    }
  }
  if (!skillUser.flags.hasDiedThisAction) {
    if (skillUser.buffs.dotDamage) {
      const damage = Math.floor(skillUser.defaultstatus.HP * skillUser.buffs.dotDamage.strength);
      console.log(`${skillUser.name}は継続ダメージで${damage}のダメージを受けた！`);
      applyDamage(skillUser, damage);
      await sleep(400); // 継続ダメージ処理後に待機時間を設ける
    }
  }

  // 7-7. 被ダメージ時発動skill処理 反撃のみisDead判定
  if (!skillUser.flags.isDead) {
    for (const enemy of parties[skillUser.enemyTeamID]) {
      if (enemy.flags.isRecentlyDamaged && !enemy.flags.isDead) {
        for (const ability of Object.values(enemy.abilities)) {
          if (ability.trigger === "damageTaken" && typeof ability.act === "function") {
            await ability.act(enemy);
            await sleep(700); // 被ダメージ時発動skill処理ごとに待機時間を設ける
          }
        }
      }
    }
  }
}

// 死亡判定を行う関数
function isDead(monster) {
  return monster.flags.isDead === true;
}

// 状態異常判定を行う関数
function hasAbnormality(monster) {
  const abnormalityKeys = ["fear", "tempted", "sealed", "confused", "paralyzed", "asleep", "stoned"];
  for (const key of abnormalityKeys) {
    if (monster.buffs[key]) {
      return true;
    }
  }
  return false;
}

// ダメージを適用する関数
function applyDamage(target, damage, resistance, MP) {
  if (resistance === -1) {
    // 回復処理
    let healAmount = Math.floor(Math.abs(damage)); // 小数点以下切り捨て＆絶対値
    if (target.buffs.healBlock) {
      //回復封じ処理
      if (MP) {
        displayDamage(target, 0, -1, MP); // MP回復封じ
      } else {
        displayDamage(target, 0, -1); // HP回復封じ
      }
      return;
    }

    if (MP) {
      // MP回復
      healAmount = Math.min(healAmount, target.defaultstatus.MP - target.currentstatus.MP);
      target.currentstatus.MP += healAmount;
      console.log(`${target.name}のMPが${healAmount}回復！`);
      displayMessage(`${target.name}の`, `MPが　${healAmount}回復した！`);
      displayDamage(target, -healAmount, -1, MP); // MP回復は負の数で表示
    } else {
      // HP回復
      healAmount = Math.min(healAmount, target.defaultstatus.HP - target.currentstatus.HP);
      target.currentstatus.HP += healAmount;
      console.log(`${target.name}のHPが${healAmount}回復！`);
      displayMessage(`${target.name}の`, `HPが　${healAmount}回復した！`);
      displayDamage(target, -healAmount, -1); // HP回復は負の数で表示
    }

    updateMonsterBar(target);
    return;
  } else {
    // ダメージ処理
    if (MP) {
      // MPダメージ
      let mpDamage = Math.min(target.currentstatus.MP, Math.floor(damage));
      target.currentstatus.MP -= mpDamage;
      console.log(`${target.name}はMPダメージを受けている！`);
      displayDamage(`${target.name}は　MPダメージを受けている！`);
      displayDamage(target, mpDamage, resistance, MP);
      updateMonsterBar(target);
      return;
    } else {
      // HPダメージ
      const Hpdamage = Math.floor(damage); // 小数点以下切り捨て
      target.currentstatus.HP -= Hpdamage;
      console.log(`${target.name}に${Hpdamage}のダメージ！`);
      if (Hpdamage === 0) {
        displayMessage(`ミス！ダメージをあたえられない！`);
      } else {
        displayMessage(`${target.name}に`, `${Hpdamage}のダメージ！！`);
      }
      displayDamage(target, Hpdamage, resistance);
      //updateMonsterBarはくじけぬ未所持判定後か、くじけぬ処理の分岐内で

      if (target.currentstatus.HP <= 0) {
        // くじけぬ処理
        if (target.buffs.isUnbreakable) {
          if (target.buffs.isUnbreakable.type === "toukon") {
            target.buffs.isUnbreakable.left--;
            if (Math.random() < 0.75) {
              handleUnbreakable(target);
            } else {
              handleDeath(target);
            }
            if (target.buffs.isUnbreakable.left <= 0) {
              delete target.buffs.isUnbreakable;
            }
          } else {
            if (target.buffs.isUnbreakable.left > 0) {
              if (target.buffs.Revive) {
                if (Math.random() < 0.75) {
                  handleUnbreakable(target);
                } else {
                  handleDeath(target);
                }
              } else {
                target.buffs.isUnbreakable.left--;
                handleUnbreakable(target);
              }
            } else {
              if (Math.random() < 0.75) {
                handleUnbreakable(target);
              } else {
                handleDeath(target);
              }
            }
          }
        } else {
          // 死亡処理
          handleDeath(target);
        }
      } else {
        updateMonsterBar(target, 1);
        return;
      }
    }
  }
}

function handleUnbreakable(target) {
  target.currentstatus.HP = 1;
  updateMonsterBar(target, 1);
  console.log(`${target.name}の特性、${target.buffs.isUnbreakable.name}が発動！`);
  displayMessage(`${target.name}の特性　${target.buffs.isUnbreakable.name}が発動！`);
  if (target.buffs.isUnbreakable.left > 0) {
    console.log(`残り${target.buffs.isUnbreakable.left}回`);
    displayMessage(`残り${target.buffs.isUnbreakable.left}回`);
  }
}

function handleDeath(target) {
  target.currentstatus.HP = 0;
  target.flags.isDead = true;
  target.flags.recentlyKilled = true;
  target.flags.beforeDeathActionCheck = true;

  if (target.flags.isSubstituting) {
    //みがわり中 hasSubstituteのtargetが死亡者と一致する場合に削除
    for (const monster of parties.flat()) {
      if (monster.flags.hasSubstitute && monster.flags.hasSubstitute.targetMonsterId === target.monsterId) {
        delete monster.flags.hasSubstitute;
        updateMonsterBuffsDisplay(monster);
      }
    }
    delete target.flags.isSubstituting;
  } else if (target.flags.hasSubstitute) {
    //みがわられ中 hasSubstituteのtargetのisSubstitutingをupdate
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
  }

  // keepOnDeathを持たないバフと異常を削除
  const newBuffs = {};
  for (const buffKey in target.buffs) {
    if (target.buffs[buffKey].keepOnDeath) {
      newBuffs[buffKey] = target.buffs[buffKey];
    }
  }
  target.buffs = newBuffs;

  // タグ変化とゾンビ化がない場合のみ、コマンドスキップ
  if (!target.buffs.tagTransformation && !target.flags.canBeZombie) {
    target.confirmedcommand = "skipThisTurn";
    target.flags.hasDiedThisAction = true;
    //次のhitSequenceも実行しない
  }
  updateMonsterBar(target, 1); //isDead付与後にupdateでbar非表示化
  updatebattleicons(target);
  updateCurrentStatus(target);
  // TODO:仮置き ここで明示的に buffContainer を削除する
  let wrapper = document.getElementById(target.iconElementId).parentElement;
  const buffContainer = wrapper.querySelector(".buff-container");
  if (buffContainer) {
    buffContainer.remove();
  }
  updateMonsterBuffsDisplay(target);
  document.getElementById(target.iconElementId).parentNode.classList.remove("stickout");
  document.getElementById(target.iconElementId).parentNode.classList.remove("recede");
  if (target.teamID === 0) {
    console.log(`${target.name}はちからつきた！`);
    displayMessage(`${target.name}は　ちからつきた！`);
  } else {
    console.log(`${target.name}をたおした！`);
    displayMessage(`${target.name}を　たおした！`);
  }
}

// スキルを実行する関数
async function executeSkill(skillUser, executingSkill, assignedTarget = null) {
  // 6. スキル実行処理
  const killedThisSkill = new Set(); // スキル実行中に死亡したモンスターを追跡
  // スキル開始時に死亡しているモンスターを記録
  for (const monster of parties.flat()) {
    if (monster.flags.isDead) {
      killedThisSkill.add(monster);
    }
  }

  //コマンドによるskill実行時にまず全てのskillUser死亡検知フラグをリセット
  if (!executingSkill.trigger || (executingSkill.trigger !== "death" && executingSkill.trigger !== "damageTaken")) {
    for (const monster of parties.flat()) {
      delete monster.flags.hasDiedThisAction;
    }
  }

  // ヒット処理の実行
  await processHitSequence(skillUser, executingSkill, assignedTarget, killedThisSkill, 0);
}

// ヒットシーケンスを処理する関数
async function processHitSequence(skillUser, executingSkill, assignedTarget, killedThisSkill, currentHit, singleSkillTarget = null) {
  if (currentHit >= (executingSkill.hitNum ?? 1)) {
    return; // ヒット数が上限に達したら終了
  }
  //毎回deathactionはしているので、停止時はreturnかけてOK
  //停止条件: all: aliveが空、random: determineの返り値がnull、single: 敵が一度でも死亡
  //hitSequenceごとに、途中で死亡時発動によってskillUserが死亡していたらreturnする
  if (skillUser.flags.hasDiedThisAction && (!executingSkill.trigger || (executingSkill.trigger !== "death" && executingSkill.trigger !== "damageTaken"))) {
    return;
  }

  let skillTarget;

  // ターゲットタイプに応じたターゲット決定処理
  switch (executingSkill.targetType) {
    case "all":
      // 全体攻撃
      // 生きているモンスターかつkilledThisSkill対象外をtargetとする
      const aliveMonsters = (executingSkill.targetTeam === "ally" ? parties[skillUser.teamID] : parties[skillUser.enemyTeamID]).filter(
        (monster) => !monster.flags.isDead && !killedThisSkill.has(monster)
      );
      if (aliveMonsters.length === 0) {
        return;
      }
      for (const target of aliveMonsters) {
        await processHit(skillUser, executingSkill, target, killedThisSkill);
      }
      break;
    case "single":
      // 単体攻撃
      if (currentHit === 0) {
        // 最初のヒット時のみターゲットを決定
        skillTarget = determineSingleTarget(assignedTarget, skillUser, executingSkill, killedThisSkill);
        // ターゲットが存在しない場合は処理を中断
        if (!skillTarget) {
          return;
        }
      } else {
        // 2回目以降のヒットの場合、最初のヒットで決定したターゲットを引き継ぐ
        skillTarget = singleSkillTarget;
        // ターゲットが死亡しているかリザオ等した場合に処理を中断
        if (skillTarget.flags.isDead || killedThisSkill.has(skillTarget)) {
          return;
        }
      }
      await processHit(skillUser, executingSkill, skillTarget, killedThisSkill);
      break;
    case "random":
      // ランダム攻撃
      skillTarget = determineRandomTarget(assignedTarget, skillUser, executingSkill, killedThisSkill, currentHit);
      if (skillTarget) {
        await processHit(skillUser, executingSkill, skillTarget, killedThisSkill);
      } else {
        return;
      }
      break;
    case "me":
      // 自分自身をターゲット
      skillTarget = skillUser;
      await processHit(skillUser, executingSkill, skillTarget, killedThisSkill);
      break;
    case "Dead":
      // 蘇生特技
      skillTarget = parties[skillUser.teamID][skillUser.confimredskilltarget];
      await processHit(skillUser, executingSkill, skillTarget, killedThisSkill);
      break;
    default:
      console.error("無効なターゲットタイプ:", executingSkill.targetType);
  }

  // 死亡時発動能力の処理
  await processDeathAction(skillUser, killedThisSkill);

  // もしkilledThisSkillにskillUserが含まれていたら、反射死と判定して次のヒットを実行せず終了
  // skillTargetの死亡等は逐次判定してDeathActionも行わずにreturn
  if (killedThisSkill.has(skillUser)) {
    return;
  } else {
    // 次のヒット処理
    currentHit++;
    await sleep(70);
    await processHitSequence(skillUser, executingSkill, assignedTarget, killedThisSkill, currentHit, skillTarget);
  }
}

// 単体攻撃のターゲットを決定する関数
function determineSingleTarget(target, skillUser, executingSkill, killedThisSkill) {
  const aliveMonsters = (executingSkill.targetTeam === "ally" ? parties[skillUser.teamID] : parties[skillUser.enemyTeamID]).filter((monster) => !monster.flags.isDead);
  if (target && !killedThisSkill.has(target) && aliveMonsters.includes(target)) {
    // 指定されたターゲットが生きていて、killedThisSkillに含まれていない場合は、そのターゲットを返す
    return target;
  } else {
    const validTargets = aliveMonsters.filter((monster) => !killedThisSkill.has(monster));
    // validTargets が空の場合の処理を追加
    if (validTargets.length > 0) {
      return validTargets[Math.floor(Math.random() * validTargets.length)];
    } else {
      return null; // ターゲットが存在しない場合は null を返す
    }
  }
}

function determineRandomTarget(target, skillUser, executingSkill, killedThisSkill, currentHit) {
  if (currentHit === 0) {
    return determineSingleTarget(target, skillUser, executingSkill, killedThisSkill);
  } else {
    const aliveMonsters = (executingSkill.targetTeam === "ally" ? parties[skillUser.teamID] : parties[skillUser.enemyTeamID]).filter((monster) => !monster.flags.isDead);
    const validTargets = aliveMonsters.filter((monster) => !killedThisSkill.has(monster));
    if (validTargets.length > 0) {
      return validTargets[Math.floor(Math.random() * validTargets.length)];
    } else {
      return null;
    }
  }
}

// ヒット処理を実行する関数
async function processHit(assignedSkillUser, executingSkill, assignedSkillTarget, killedThisSkill) {
  let skillTarget = assignedSkillTarget;
  let skillUser = assignedSkillUser;
  let isReflection = false;
  let reflectionType = "yosoku";
  // みがわり処理 味方補助でないまたはみがわり無視でないときに処理
  if (assignedSkillTarget.flags.hasSubstitute && (!executingSkill.ignoreSubstitute || !(executingSkill.howToCalculate === "none" && executingSkill.targetTeam === "ally"))) {
    skillTarget = parties.flat().find((monster) => monster.monsterId === assignedSkillTarget.flags.hasSubstitute.targetMonsterId);
  }

  // ダメージなし特技は、みがわり処理後に種別無効処理・反射処理を行ってprocessAppliedEffectに送る
  if (executingSkill.howToCalculate === "none") {
    // 種別無効かつ無効貫通でない かつ味方対象ではないときには種別無効処理 ミス表示後にreturn
    if (!executingSkill.ignoreTypeEvasion && skillTarget.buffs[executingSkill.type + "Evasion"] && executingSkill.targetTeam !== "ally") {
      applyDamage(skillTarget, 0, "");
      return false;
    }
    // 反射持ちかつ反射無視でない、かつ味方対象ではなく、かつ波動系ではないならば反射化
    if (
      executingSkill.targetTeam !== "ally" &&
      !executingSkill.ignoreReflection &&
      (skillTarget.buffs[executingSkill.type + "Reflection"] || (skillTarget.buffs.slashReflection && skillTarget.buffs.slashReflection.type === "kanta" && executingSkill.type === "notskill")) &&
      executingSkill.appliedEffect !== "divineWave" &&
      executingSkill.appliedEffect !== "disruptiveWave"
    ) {
      isReflection = true;
      //反射演出
      addMirrorEffect(skillTarget.iconElementId);
      //全ての場合でカンタと同様に、skillUserとskillTargetを入れ替え (applyBuff内での耐性処理のため)
      skillUser = skillTarget;
      skillTarget = assignedSkillUser;
    }
    // isDamageExsistingはfalseで送る
    processAppliedEffect(skillTarget, executingSkill, skillUser, false, isReflection);
    return false;
  }

  function processAppliedEffect(buffTarget, executingSkill, skillUser, isDamageExsisting, isReflection) {
    // AppliedEffect指定されてたら、規定値による波動処理またはapplybuff
    if (executingSkill.appliedEffect) {
      if (executingSkill.appliedEffect === "radiantWave") {
        executeRadiantWave(buffTarget);
      } else if (executingSkill.appliedEffect === "divineWave") {
        executeDivineWave(buffTarget);
      } else if (executingSkill.appliedEffect === "disruptiveWave") {
        executeDisruptiveWave(buffTarget);
      } else {
        applyBuff(buffTarget, structuredClone(executingSkill.appliedEffect), skillUser, isReflection);
      }
    }
    //act処理
    if (executingSkill.act) {
      executingSkill.act(skillUser, buffTarget);
      updateCurrentStatus(skillUser);
      updateMonsterBuffsDisplay(skillUser);
      updateCurrentStatus(buffTarget);
      updateMonsterBuffsDisplay(buffTarget);
    }
  }

  // みかわし・マヌーサ処理
  if (["atk", "def", "spd"].includes(executingSkill.howToCalculate)) {
    const isMissed = checkEvasionAndDazzle(assignedSkillUser, executingSkill, skillTarget);
    if (isMissed === "miss") {
      applyDamage(skillTarget, 0, "");
      return false;
    }
  }

  //耐性処理
  let resistance = calculateResistance(assignedSkillUser, executingSkill.element, skillTarget, fieldState.isDistorted);

  // 吸収以外の場合に、種別無効処理と反射処理
  let skillUserForAppliedEffect = skillUser;
  if (resistance !== -1) {
    // 種別無効かつ無効貫通でない かつ味方対象ではないときには種別無効処理 ミス表示後にreturn
    if (!executingSkill.ignoreTypeEvasion && skillTarget.buffs[executingSkill.type + "Evasion"] && executingSkill.targetTeam !== "ally") {
      applyDamage(skillTarget, 0, "");
      return false;
    }
    //反射持ちかつ反射無視でない かつ味方対象ではないならば反射化し、耐性も変更
    if (
      executingSkill.targetTeam !== "ally" &&
      !executingSkill.ignoreReflection &&
      (skillTarget.buffs[executingSkill.type + "Reflection"] || (skillTarget.buffs.slashReflection && skillTarget.buffs.slashReflection.type === "kanta" && executingSkill.type === "notskill"))
    ) {
      isReflection = true;
      resistance = 1;
      //反射演出
      addMirrorEffect(skillTarget.iconElementId);
      //予測のとき: skillUserはそのまま カンタのとき: skillUserをskillTargetに変更 target自身が打ち返す
      const skillType = executingSkill.type === "notskill" ? "slash" : executingSkill.type;
      if (skillTarget.buffs[skillType + "Reflection"].type === "kanta") {
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

  // ダメージ計算
  let baseDamage = 0;
  let isCriticalHit = false;
  if (executingSkill.howToCalculate === "fix") {
    if (executingSkill.damageByLevel) {
      const randomMultiplier = Math.floor(Math.random() * 21) * 0.01 + 0.9;
      baseDamage = Math.floor(executingSkill.damage * randomMultiplier);
    } else {
      const randomMultiplier = Math.floor(Math.random() * 11) * 0.005 + 0.975;
      baseDamage = Math.floor(executingSkill.damage * randomMultiplier);
    }
  } else if (executingSkill.ratio) {
    const status = {
      atk: skillUser.currentstatus.atk,
      def: skillUser.currentstatus.def,
      spd: skillUser.currentstatus.spd,
      int: skillUser.currentstatus.int,
    }[executingSkill.howToCalculate];

    //魅了判定と超ドレアム判定 以下targetDefを用いる
    let targetDef = skillTarget.currentstatus.def;
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
    } else if (executingSkill.howToCalculate !== "int") {
      // criticalHitProbabilityが存在せず、howToCalculateがintではない場合
      isCriticalHit = Math.random() < 0.009;
    }

    if (isCriticalHit) {
      // 会心の一撃成功時
      const criticalHitMultiplier = 0.95 + 0.01 * Math.floor(Math.random() * 11);
      baseDamage = Math.floor((status / 2) * criticalHitMultiplier);
    } else {
      // 会心の一撃が発生しない場合
      const statusRatio = targetDef / status;

      if (statusRatio >= 0 && statusRatio < 1.75) {
        // 割った値が0以上1.75未満の場合
        baseDamage = status / 2 - targetDef / 4;
        const randomOffset = (Math.random() * baseDamage) / 8 - baseDamage / 16 + Math.random() * 2 - 1;
        baseDamage = Math.floor(baseDamage + randomOffset);
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
    const { minInt, maxInt, minIntDamage, maxIntDamage } = executingSkill;
    const int = skillUser.currentstatus.int;
    if (int <= minInt) {
      baseDamage = minIntDamage;
    } else if (int >= maxInt) {
      baseDamage = maxIntDamage;
    } else {
      baseDamage = Math.floor(((int - minInt) * (maxIntDamage - minIntDamage)) / (maxInt - minInt)) + Number(minIntDamage);
    }
    // 特技プラスと賢さ差ボーナスを乗算
    const intDiff = skillUser.currentstatus.int - skillTarget.currentstatus.int;
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
    const randomMultiplier = Math.floor(Math.random() * 11) * 0.005 + 0.975;
    baseDamage = Math.floor(baseDamage * randomMultiplier);
    baseDamage *= executingSkill.skillPlus * intBonus;
  }
  let damage = baseDamage;

  //呪文会心
  if (executingSkill.type === "spell" && executingSkill.howToCalculate === "int" && !executingSkill.ratio && !executingSkill.noSpellSurge) {
    //確率で暴走
  }

  //会心完全ガード

  //弱点1.8倍処理
  if (resistance === 1.5 && executingSkill.weakness18) {
    damage *= 1.2;
  }

  //大弱点、超弱点処理
  if (resistance === 1.5 && skillUser.buffs.ultraWeakness) {
    resistance = 2.5;
  } else if (resistance === 1.5 && skillUser.buffs.superWeakness) {
    resistance = 2;
  }
  //耐性処理
  damage *= resistance;

  //ぼうぎょ
  if (!executingSkill.ignoreGuard && skillTarget.flags.guard) {
    damage *= 0.5;
  }

  //連携

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
    //魔力覚醒
    if (skillUser.buffs.manaBoost && !executingSkill.ignoreManaBoost && executingSkill.howToCalculate === "int" && executingSkill.type === "spell") {
      damage *= skillUser.buffs.manaBoost.strength;
    }
    //力ため 斬撃体技踊りまたはatk依存
    if (
      skillUser.buffs.powerCharge &&
      !executingSkill.ignorePowerCharge &&
      (executingSkill.howToCalculate === "atk" || executingSkill.type === "slash" || executingSkill.type === "martial" || executingSkill.type === "dance")
    ) {
      damage *= skillUser.buffs.powerCharge.strength;
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
  if (skillTarget.buffs[barrierType] && !(executingSkill.criticalHitProbability && isCriticalHit)) {
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
  if (!isReflection && skillTarget.buffs.metal) {
    damage *= skillTarget.buffs.metal.strength;
    //メタルキラー処理
    if (skillUser.buffs.metalKiller && skillTarget.buffs.metal.type === "metal") {
      damage *= 1 - skillUser.buffs.metalKiller.strength;
    }
  }

  //ダメージ軽減
  if (!executingSkill.ignoreProtection && skillTarget.buffs.protection) {
    damage *= 1 - skillTarget.buffs.protection.strength;
  }

  //特技の種族特効 反射には乗らない
  if (!isReflection && executingSkill.RaceBane && executingSkill.RaceBane.includes(skillTarget.type)) {
    damage *= executingSkill.RaceBaneValue;
  }
  //みがわり特効
  if (executingSkill.SubstituteBreaker && skillTarget.flags.isSubstituting) {
    damage *= executingSkill.SubstituteBreaker;
  }
  //魔神の金槌など

  // anchorBonus
  if (executingSkill.anchorBonus) {
  }

  //以下加算処理
  const AllElements = ["fire", "ice", "thunder", "wind", "io", "light", "dark"];
  let damageModifier = 1;

  //全属性バフ
  if (skillUser.buffs.allElementalBoost && AllElements.includes(executingSkill.element)) {
    damageModifier += skillUser.buffs.allElementalBoost.strength;
  }
  //軽減系
  //全ダメージ軽減
  if (skillTarget.buffs.shinriReduction) {
    damageModifier += skillTarget.buffs.shinriReduction.strength;
  }

  damage *= damageModifier;

  // ダメージ処理
  applyDamage(skillTarget, damage, resistance);

  //target生存かつdamageが0超えのときに、追加効果付与を実行
  if (!skillTarget.flags.recentlyKilled && damage > 0) {
    processAppliedEffect(skillTarget, executingSkill, skillUserForAppliedEffect, true, isReflection);
  }

  //ダメージ処理直後にrecentlyを持っている敵を、渡されてきたkilledThisSkillに追加
  if (skillTarget.flags.recentlyKilled) {
    if (!killedThisSkill.has(skillTarget)) {
      killedThisSkill.add(skillTarget);
    }
    delete skillTarget.flags.recentlyKilled;
  }
  // 大元のスキル使用者(assignedSkillUser)が死亡したら true を返す
  if (assignedSkillUser.flags.recentlyKilled) {
    if (!killedThisSkill.has(assignedSkillUser)) {
      killedThisSkill.add(skillTarget);
    }
    delete assignedSkillUser.flags.recentlyKilled;
    return true;
  } else {
    return false;
  }
}

function checkEvasionAndDazzle(skillUser, executingSkill, skillTarget) {
  // マヌーサ処理
  if (skillUser.buffs.dazzle && !executingSkill.ignoreDazzle) {
    if (Math.random() < 0.36) {
      console.log(`${skillTarget.name}は目を回して攻撃を外した！`);
      return "miss";
    }
  }
  // みかわし処理
  if (!executingSkill.ignoreEvasion) {
    // みかわしバフ
    if (skillTarget.buffs.dodgeBuff) {
      if (Math.random() < skillTarget.buffs.dodgeBuff.strength) {
        console.log(`${skillTarget.name}は攻撃をかわした！`);
        return "miss";
      }
    }
    // 素早さによる回避
    else {
      const speedRatio = skillTarget.currentstatus.spd / skillUser.currentstatus.spd;
      let evasionRate = 0;
      if (speedRatio >= 1 && speedRatio < 1.5) {
        evasionRate = 0.01; //下方修正
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

      if (Math.random() < evasionRate) {
        console.log(`${skillTarget.name}は攻撃をかわした！`);
        return "miss";
      }
    }
  }
  // みかわし・マヌーサ処理が適用されなかった場合
  return "hit";
}

//damageCalc、耐性表示、耐性ダウン付与、状態異常耐性取得で実行。耐性ダウン確率判定ではskillUserをnull指定
function calculateResistance(skillUser, executingSkillElement, skillTarget, distorted = null) {
  const element = executingSkillElement;
  const baseResistance = skillTarget.resistance[element] ?? 1;
  const resistanceValues = [-1, 0, 0.25, 0.5, 0.75, 1, 1.5];
  const distortedResistanceValues = [1.5, 1.5, 1.5, 1, 1, 0, -1];

  // --- 無属性の処理 ---
  if (element === "notskill") {
    return 1;
  }
  if (element === "none") {
    let noneResistance = 1; //初期値
    if (skillTarget.buffs.nonElementalResistance) {
      noneResistance = 0;
    }
    if (!distorted && skillTarget.name === "ダグジャガルマ") {
      noneResistance = -1; //非歪曲
    } else if (skillTarget.name === "ダグジャガルマ") {
      noneResistance = 1.5; //歪曲
    }
    return noneResistance;
  }

  // --- 通常時の処理 ---
  if (!distorted) {
    let normalResistanceIndex = resistanceValues.indexOf(baseResistance);

    //もともと無効や吸収のときは処理せずにそのまま格納 それ以外の場合はバフ等があれば反映した後、最大でも無効止まりにする
    if (normalResistanceIndex !== 0 && normalResistanceIndex !== 1) {
      // 装備効果
      if (skillTarget.abilities[element + "gearResistance"]) {
        normalResistanceIndex -= skillTarget.abilities[element + "gearResistance"].strength;
      }
      // 属性耐性バフ効果
      if (skillTarget.buffs[element + "Resistance"]) {
        normalResistanceIndex -= skillTarget.buffs[element + "Resistance"].strength;
      }
      // インデックスの範囲を制限 最大でも無効
      normalResistanceIndex = Math.max(1, Math.min(normalResistanceIndex, 6));
    }
    //ここまでの処理の結果を格納
    let normalResistance = resistanceValues[normalResistanceIndex];

    // skillUserが渡された場合のみ使い手効果を適用
    if (skillUser) {
      const AllElements = ["fire", "ice", "thunder", "wind", "io", "light", "dark"];
      if (skillUser.buffs[element + "Break"]) {
        normalResistanceIndex += skillUser.buffs[element + "Break"].strength;
      } else if (skillUser.buffs.allElementalBreak && AllElements.includes(element)) {
        //全属性の使い手 状態異常以外 普通の属性の場合に処理
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
  } else {
    // --- 属性歪曲時の処理 ---
    let distortedResistanceIndex = resistanceValues.indexOf(baseResistance);

    // 装備効果・属性耐性バフ効果 反転後に無効吸収になる弱点普通は変化させない
    if (distortedResistanceIndex !== 5 && distortedResistanceIndex !== 6) {
      // 装備効果
      if (skillTarget.abilities[element + "gearResistance"]) {
        distortedResistanceIndex += skillTarget.abilities[element + "gearResistance"].strength;
      }
      // 属性耐性バフ効果
      if (skillTarget.buffs[element + "Resistance"]) {
        distortedResistanceIndex += skillTarget.buffs[element + "Resistance"].strength;
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
  }
}

// 死亡時発動能力のキュー
let deathActionQueue = [];

// processDeathActionの実行中かどうかを示すフラグ
let isProcessingDeathAction = false;

// 死亡時発動能力の処理
async function processDeathAction(skillUser, killedThisSkill) {
  // キューに死亡時発動能力を持つモンスターを追加する関数
  function enqueueDeathAction(monster) {
    if (monster.flags.beforeDeathActionCheck && !deathActionQueue.includes(monster)) {
      deathActionQueue.unshift(monster);
    }
  }
  // 敵逆順処理
  for (const monster of [...parties[skillUser.enemyTeamID]].reverse()) {
    if (killedThisSkill.has(monster)) {
      enqueueDeathAction(monster);
    }
  }
  // 味方逆順処理
  for (const monster of [...parties[skillUser.teamID]].reverse()) {
    if (killedThisSkill.has(monster)) {
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

    // 死亡時発動能力の実行
    await executeDeathAbilities(monster);

    // 復活処理
    if (monster.buffs.Revive || monster.buffs.tagTransformation) {
      await reviveMonster(monster);
    } else {
      await zombifyMonster(monster);
    }
  }
  isProcessingDeathAction = false;
}

// 死亡時発動能力を実行する関数
async function executeDeathAbilities(monster) {
  const abilitiesToExecute = [];

  // 復活とタグ変化が予定されているか判定
  let isReviving = monster.buffs.Revive || monster.buffs.tagTransformation;

  for (const ability of Object.values(monster.abilities)) {
    if (ability.left === undefined || ability.left > 0) {
      if (ability.triggerDeathType === "exceptRevive" && isReviving) {
        continue;
      }
      abilitiesToExecute.push(ability);
      if (ability.left !== undefined) {
        ability.left--;
      }
    }
  }

  for (const ability of abilitiesToExecute) {
    await sleep(350);
    await ability.act(monster);
    await sleep(350);
  }
}

// モンスターを蘇生させる関数
async function reviveMonster(monster) {
  await sleep(600);
  let reviveSource = monster.buffs.tagTransformation || monster.buffs.Revive;

  delete monster.flags.isDead;
  if (reviveSource === monster.buffs.Revive) {
    monster.currentstatus.HP = Math.ceil(monster.defaultstatus.HP * reviveSource.strength);
  } else {
    //タッグ変化時はHPmaxで復活
    monster.currentstatus.HP = monster.defaultstatus.HP;
  }
  updateMonsterBar(monster);
  updatebattleicons(monster);
  console.log(`なんと${monster.name}が生き返った！`);
  displayMessage(`なんと${monster.name}が生き返った！`);
  if (reviveSource.act) {
    reviveSource.act();
  }
  delete monster.buffs[reviveSource === monster.buffs.Revive ? "Revive" : "tagTransformation"];
  await sleep(400);
}

// モンスターを亡者化させる関数
async function zombifyMonster(monster) {
  if (monster.flags.isDead && monster.flags.canBeZombie && (!monster.flags.canBeZombie.probability || Math.random() < monster.flags.canBeZombie.probability)) {
    await sleep(600);
    delete monster.flags.isDead;
    monster.flags.isZombie = true;
    updatebattleicons(monster);
    await sleep(400);
    return true;
  }
  return false;
}

// 指定 milliseconds だけ処理を一時停止する関数
function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// フラグをチェックする関数
function checkFlag(target, flagName) {
  return target.flags[flagName] === true;
}

//AI追撃targetを返す
function decideNormalAttackTarget(skillUser) {
  const enemyParty = parties[skillUser.enemyTeamID];
  let target = null;
  let minHPRatio = Infinity;
  let minIndex = Infinity;

  // 敵パーティ内の各モンスターに対して
  for (let i = 0; i < enemyParty.length; i++) {
    const monster = enemyParty[i];
    // isDeadのフラグを持っている場合はスキップ
    if (monster.flags.isDead) {
      continue;
    }
    // 有効な攻撃対象の判定
    const isValidTarget = !hasAbnormalityofAINormalAttack(monster) || !(monster.buffs.slashReflection && monster.buffs.slashReflection.type === "kanta");
    // 有効な攻撃対象でない場合はスキップ
    if (!isValidTarget) {
      continue;
    }
    // 残存HP割合を計算
    const hpRatio = monster.currentstatus.HP / monster.defaultstatus.HP;
    // 残存HP割合が今までの最小値より小さいか、同じ場合はindexが小さい場合
    if (hpRatio < minHPRatio || (hpRatio === minHPRatio && i < minIndex)) {
      target = monster;
      minHPRatio = hpRatio;
      minIndex = i;
    }
  }
  // 有効な攻撃対象が見つからなかった場合、条件を緩和(atakan可)して再検索
  if (target === null) {
    for (let i = 0; i < enemyParty.length; i++) {
      const monster = enemyParty[i];
      // isDeadのフラグを持っている場合はスキップ
      if (monster.flags.isDead) {
        continue;
      }
      // 残存HP割合を計算
      const hpRatio = monster.currentstatus.HP / monster.defaultstatus.HP;
      // 残存HP割合が今までの最小値より小さいか、同じ場合はindexが小さい場合
      if (hpRatio < minHPRatio || (hpRatio === minHPRatio && i < minIndex)) {
        target = monster;
        minHPRatio = hpRatio;
        minIndex = i;
      }
    }
  }

  return target;
}

function hasAbnormalityofAINormalAttack(monster) {
  const abnormalityKeys = ["confused", "paralyzed", "asleep"];
  //Todo: 麻痺どうだっけ
  for (const key of abnormalityKeys) {
    if (monster.buffs[key]) {
      return true;
    }
  }
  return false;
}

//monster選択部分
let selectingmonstericon = "";
let selectingmonsternum = "";
let selectingmonsternumminus1 = "";
const partyIcons = document.querySelectorAll(".partyicon");
partyIcons.forEach((icon) => {
  icon.addEventListener("click", function () {
    document.body.style.overflow = "hidden";
    //todo:?
    document.getElementById("selectmonsteroverlay").style.visibility = "visible";
    document.getElementById("selectmonsterpopupwindow").style.opacity = "1";
    selectingmonstericon = icon.id;
    selectingmonsternum = selectingmonstericon.replace(/(party|icon)/g, "");
    selectingmonsternum = Number(selectingmonsternum);
    selectingmonsternumminus1 = selectingmonsternum - 1;
    //配列検索用に-1
  });
});
//枠をクリック時、ウィンドウを開き、どの枠を選択中か取得、selectingmonstericonにidを格納-partyicon1、selectingmonsternumに1-5を格納、minus1に配列用で1引いてっか右脳

document.getElementById("selectmonsteroverlay").addEventListener("click", function () {
  //ここselectmonsterbg_grayではなくselectmonsteroverlayにすると、ウィンドウ白部分をタップでウィンドウ閉じるように
  document.getElementById("selectmonsteroverlay").style.visibility = "hidden";
  document.getElementById("selectmonsterpopupwindow").style.opacity = "0";
  document.body.style.overflow = "";
});
//まわりクリックで閉じる

document.querySelectorAll(".allmonstericons").forEach((img) => {
  img.addEventListener("click", () => {
    const imgsrc = img.getAttribute("src");
    const selectedmonsterName = imgsrc.replace("images/icons/", "").replace(".jpeg", "");
    selectMonster(selectedmonsterName);
  });
});
//window内の各画像クリックで、選択処理を起動

function selectMonster(monsterName) {
  //ポップアップ内各画像クリック時に起動
  const newmonsterImageSrc = "images/icons/" + monsterName + ".jpeg";
  document.getElementById(selectingmonstericon).src = newmonsterImageSrc;
  //取得した選択中の枠に、ポップアップウィンドウ内で選択したモンスターの画像を代入
  //todo:tabの処理と共通化
  //todo:-1処理の削除

  const targetgear = "partygear" + selectingmonsternum;
  document.getElementById(targetgear).src = "images/gear/ungeared.jpeg";
  //装備リセットのため装備アイコンを未選択にselectingmonsternum

  party[selectingmonsternumminus1] = monsters.find((monster) => monster.id == monsterName);
  //selectingmonsternum-1でparty配列内の何番目の要素か指定、party配列内に引数monsterNameとidが等しいmonsterのデータの配列を丸ごと代入

  party[selectingmonsternumminus1].displaystatus = party[selectingmonsternumminus1].status;
  party[selectingmonsternumminus1].gearzoubun = defaultgearzoubun;
  //表示値を宣言、statusを初期値として代入、以下switchtabで種や装備処理を行い、追加する

  //格納後、新規モンスターの詳細を表示するため、selectingmonsternumのtabに表示を切り替える
  switchTab(selectingmonsternum);

  // ポップアップウィンドウを閉じる
  document.getElementById("selectmonsteroverlay").style.visibility = "hidden";
  document.getElementById("selectmonsterpopupwindow").style.opacity = "0";
  document.body.style.overflow = "";
}
//ウィンドウ内クリックでそれを代入してウィンドウを閉じる

let defaultgearzoubun = {
  HP: 0,
  MP: 0,
  atk: 0,
  def: 0,
  spd: 0,
  int: 0,
};

//装備選択部分
let selectinggear = "";
let selectinggearnum = "";
let selectinggearnumminus1 = "";

const partyGear = document.querySelectorAll(".partygear");
partyGear.forEach((icon) => {
  icon.addEventListener("click", function () {
    document.body.style.overflow = "hidden";
    document.getElementById("selectgearoverlay").style.visibility = "visible";
    document.getElementById("selectgearpopupwindow").style.opacity = "1";
    selectinggear = icon.id;
    selectinggearnum = selectinggear.replace(/(party|gear)/g, "");
    selectinggearnum = Number(selectinggearnum);
    selectinggearnumminus1 = selectinggearnum - 1;
    //配列検索用に-1
  });
});
//装備枠クリック時、ウィンドウを開き、どの装備枠を選択中か取得、selectinggearにidを格納-partygear1、selectinggearnumに1-5を格納

document.getElementById("selectgearoverlay").addEventListener("click", function () {
  //ここselectgearbg_grayではなくselectgearoverlayにすると、ウィンドウ白部分をタップでウィンドウ閉じる
  document.getElementById("selectgearoverlay").style.visibility = "hidden";
  document.getElementById("selectgearpopupwindow").style.opacity = "0";
  document.body.style.overflow = "";
});
//まわりクリックで閉じる

document.querySelectorAll(".allgear").forEach((img) => {
  img.addEventListener("click", () => {
    const imgsrc = img.getAttribute("src");
    const selectedgearName = imgsrc.replace("images/gear/", "").replace(".jpeg", "");
    selectgear(selectedgearName);
  });
});
//window内の各画像クリックで、選択処理を起動

function selectgear(gearName) {
  // ポップアップウィンドウ内で選択した装備の画像をポップアップを開く画像に置き換える
  const newgearImageSrc = "images/gear/" + gearName + ".jpeg";
  document.getElementById(selectinggear).src = newgearImageSrc;
  //取得した選択中の枠に、ウィンドウ内で選択した装備を代入

  party[selectinggearnumminus1].gear = gear.find((gear) => gear.id == gearName);
  //selectinggearnum-1でparty配列内の何番目の要素か指定、party配列内の、さらに該当要素のgear部分に引数gearNameとidが等しいgearのデータの配列を丸ごと代入
  party[selectinggearnumminus1].gearzoubun = party[selectinggearnumminus1].gear.status;

  //tab遷移は不要、tabm1も不変のため、gear格納、gearstatusをgearzoubunに格納、display再計算、表示変更
  calcandadjustdisplaystatus();

  // ポップアップウィンドウを閉じる
  document.getElementById("selectgearoverlay").style.visibility = "hidden";
  document.getElementById("selectgearpopupwindow").style.opacity = "0";
  document.body.style.overflow = "";
}
//ウィンドウ内クリックでそれを代入してウィンドウを閉じる
//装備選択部分終了

//タブ遷移時や新規モンス選択時起動、currentTabのステータス、特技、種表示
function adjuststatusandskilldisplay() {
  //丸ごと放り込まれているor操作済みのため、ただ引っ張ってくれば良い
  //下に移動
  //ステ表示変更

  //特技を取り出す、party[tabm1].skill[0]がryohu
  //party内該当monsterのskillのn番目要素と同じ文字列のidをskill配列からfind、そのnameを表示
  document.getElementById("skill1").textContent = party[tabm1].skill[0];
  document.getElementById("skill2").textContent = party[tabm1].skill[1];
  document.getElementById("skill3").textContent = party[tabm1].skill[2];
  document.getElementById("skill4").textContent = party[tabm1].skill[3];
  //特技表示変更

  document.getElementById("selectseed-atk").value = party[tabm1].seed.atk;
  document.getElementById("selectseed-def").value = party[tabm1].seed.def;
  document.getElementById("selectseed-spd").value = party[tabm1].seed.spd;
  document.getElementById("selectseed-int").value = party[tabm1].seed.int;
  changeseedselect();
  //種表示変更
}

//装備変更時とタブ遷移時に起動する、装備表示変更処理?

// 初期値、select要素を取得
var selectElementsseed = document.querySelectorAll(".selectseed");
let selectseedatk = "";
let selectseeddef = "";
let selectseedspd = "";
let selectseedint = "";

//種変更検知後、値を取得、party内の現在のtabのmonsterに格納、種max120処理と、seedzoubuncalcによる増分計算、格納、表示
//tab遷移、モンスター変更時いずれも、switchTabからadjuststatusandskilldisplay、changeseedselectを起動、seedzoubuncalcで増分計算
function changeseedselect() {
  // 選択された数値を取得
  selectseedatk = document.getElementById("selectseed-atk").value;
  selectseeddef = document.getElementById("selectseed-def").value;
  selectseedspd = document.getElementById("selectseed-spd").value;
  selectseedint = document.getElementById("selectseed-int").value;

  //この新たな値を、party配列内の表示中のタブのseed情報に格納
  party[tabm1].seed.atk = selectseedatk;
  party[tabm1].seed.def = selectseeddef;
  party[tabm1].seed.spd = selectseedspd;
  party[tabm1].seed.int = selectseedint;
  seedzoubuncalc();

  // 120上限種無効化処理
  var remainingselectseedsum = 120 - Number(selectseedatk) - Number(selectseeddef) - Number(selectseedspd) - Number(selectseedint);
  // どれだけ追加で振れるか
  selectElementsseed.forEach(function (element) {
    var selectedValue = parseInt(element.value);
    const newlimit = remainingselectseedsum + selectedValue;

    var options = element.options;
    for (var i = 0; i < options.length; i++) {
      var optionValue = parseInt(options[i].value);
      if (optionValue > newlimit) {
        options[i].disabled = true;
      } else {
        options[i].disabled = false;
      }
    }
  });
}

//select変化時、全部の合計値を算出、
//120-その合計値を算出 = remain
//すべてのselectで、現状の値+remainを超える選択肢をdisable化

//増分計算fun selectseedatkを元に、増分計算・表示、増分をparty該当モンスター内に格納
function seedzoubuncalc() {
  let seedzoubun = {
    HP: "",
    MP: "",
    atk: "",
    def: "",
    spd: "",
    int: "",
  };

  //事前定義
  function seedcalc(limit, targetarray) {
    let sum = 0;
    for (let i = 0; i < limit; i++) {
      sum += targetarray[i];
    }
    return sum;
  }
  //種を5で割った数値までの配列内の項をすべて足す
  const atkseedarrayatk = [4, 0, 10, 0, 10, 0, 10, 0, 6, 0, 6, 0, 6, 0, 4, 0, 2, 0, 2, 0];
  const atkseedarrayHP = [0, 4, 0, 4, 0, 4, 0, 3, 0, 3, 0, 2, 0, 2, 0, 2, 0, 1, 0, 1];
  const defseedarraydef = [8, 0, 20, 0, 20, 0, 20, 0, 12, 0, 12, 0, 12, 0, 8, 0, 4, 0, 4, 0];
  const defseedarrayHP = [0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2];
  const defseedarrayMP = [0, 4, 0, 0, 0, 4, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 2, 0, 0];

  const atkseedlimit = selectseedatk / 5;
  const defseedlimit = selectseeddef / 5;
  const spdseedlimit = selectseedspd / 5;
  const intseedlimit = selectseedint / 5;

  HPzoubun = seedcalc(atkseedlimit, atkseedarrayHP) + seedcalc(defseedlimit, defseedarrayHP) + seedcalc(spdseedlimit, defseedarrayMP);
  MPzoubun = seedcalc(defseedlimit, defseedarrayMP) + seedcalc(spdseedlimit, defseedarrayHP) + seedcalc(intseedlimit, atkseedarrayHP);
  atkzoubun = seedcalc(atkseedlimit, atkseedarrayatk);
  defzoubun = seedcalc(defseedlimit, defseedarraydef);
  spdzoubun = seedcalc(spdseedlimit, atkseedarrayatk);
  intzoubun = seedcalc(intseedlimit, defseedarraydef);

  //zoubun配列内に代入
  seedzoubun.HP = HPzoubun;
  seedzoubun.MP = MPzoubun;
  seedzoubun.atk = atkzoubun;
  seedzoubun.def = defzoubun;
  seedzoubun.spd = spdzoubun;
  seedzoubun.int = intzoubun;

  document.getElementById("status-info-seedgear-HP").textContent = `(+${HPzoubun})`;
  document.getElementById("status-info-seedgear-MP").textContent = `(+${MPzoubun})`;
  document.getElementById("status-info-seedgear-atk").textContent = `(+${atkzoubun})`;
  document.getElementById("status-info-seedgear-def").textContent = `(+${defzoubun})`;
  document.getElementById("status-info-seedgear-spd").textContent = `(+${spdzoubun})`;
  document.getElementById("status-info-seedgear-int").textContent = `(+${intzoubun})`;
  //増分表示
  party[tabm1].seedzoubun = seedzoubun;
  //増分格納

  calcandadjustdisplaystatus();
} //finish seedzoubuncalc

function calcandadjustdisplaystatus() {
  //statusとseedzoubunとgearzoubunを足して、displaystatusを計算、表示更新

  party[tabm1].displaystatus = {
    HP: party[tabm1].status.HP + party[tabm1].seedzoubun.HP + party[tabm1].gearzoubun.HP,
    MP: party[tabm1].status.MP + party[tabm1].seedzoubun.MP + party[tabm1].gearzoubun.MP,
    atk: party[tabm1].status.atk + party[tabm1].seedzoubun.atk + party[tabm1].gearzoubun.atk,
    def: party[tabm1].status.def + party[tabm1].seedzoubun.def + party[tabm1].gearzoubun.def,
    spd: party[tabm1].status.spd + party[tabm1].seedzoubun.spd + party[tabm1].gearzoubun.spd,
    int: party[tabm1].status.int + party[tabm1].seedzoubun.int + party[tabm1].gearzoubun.int,
  };

  document.getElementById("status-info-displayHP").textContent = party[tabm1].displaystatus.HP;
  document.getElementById("status-info-displayMP").textContent = party[tabm1].displaystatus.MP;
  document.getElementById("status-info-displayatk").textContent = party[tabm1].displaystatus.atk;
  document.getElementById("status-info-displaydef").textContent = party[tabm1].displaystatus.def;
  document.getElementById("status-info-displayspd").textContent = party[tabm1].displaystatus.spd;
  document.getElementById("status-info-displayint").textContent = party[tabm1].displaystatus.int;

  //表示値更新
}

//タブ処理

//tab選択時の詳細や表示中の切り替えだけ
function addTabclass(targettabnum) {
  const tabButtons = document.querySelectorAll(".monster-info-tabs");
  const targetTabButton = document.getElementById(`tab${targettabnum}`);
  tabButtons.forEach((tabButton) => {
    tabButton.classList.remove("selectedtab");
    tabButton.textContent = "詳細";
  });
  targetTabButton.classList.add("selectedtab");
  targetTabButton.textContent = "表示中";
}

let currentTab = 1;
let tabm1 = 0;
function switchTab(tabNumber) {
  //tab button押した時または新規モンスター選択時に起動、タブ自体の詳細/表示中を切り替え、currentTabに表示中のtabnumを格納、引数tabNumber番目のモンスター情報を取り出して下に表示(ステ、特技、種)
  currentTab = tabNumber;
  tabm1 = currentTab - 1;
  adjuststatusandskilldisplay();
  //ステ特技種の呼び出しと表示へ
  // タブボタンに枠線を追加する
  addTabclass(tabNumber);
}

//monster data
//枠を作成
//必要に応じて、2パテ目とかも

const monsters = [
  {
    name: "マスタードラゴン",
    id: "masudora",
    type: "ドラゴン",
    status: { HP: 886, MP: 398, atk: 474, def: 536, spd: 550, int: 259 },
    skill: ["天空竜の息吹", "エンドブレス", "テンペストブレス", "煉獄火炎"],
    attribute: {
      1: {
        breathEnhancement: { keepOnDeath: true },
        isUnbreakable: { keepOnDeath: true, left: 3, type: "toukon", name: "とうこん" },
        mindAndSealBarrier: { keepOnDeath: true },
        breathCharge: { strength: 1.2 },
        allElementalBreak: { strength: 1, duration: 4, divineDispellable: true, targetType: "ally" },
        allElementalBoost: { strength: 0.2, duration: 4, targetType: "ally" },
      },
      2: { breathCharge: { strength: 1.5 } },
      3: { breathCharge: { strength: 2 } },
    },
    seed: { atk: 15, def: 35, spd: 70, int: 0 },
    ls: { HP: 1.15, spd: 1.3 },
    lstarget: "ドラゴン",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 1, thunder: -1, wind: 1, io: 0.5, light: 0, dark: 1, poisoned: 0, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "宵の華シンリ",
    id: "sinri",
    type: "ドラゴン",
    status: { HP: 772, MP: 365, atk: 293, def: 341, spd: 581, int: 483 },
    skill: ["涼風一陣", "神楽の術", "昇天斬り", "タップダンス"],
    attribute: {
      permanentBuffs: {
        mindAndSealBarrier: { divineDispellable: true, duration: 3, probability: 0.25 },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1, spd: 1 },
    lstarget: "ドラゴン",
    resistance: { fire: 0, ice: 0, thunder: 1, wind: 1, io: 1, light: 0.5, dark: 1, poisoned: 1, asleep: 0.5, confused: 1, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 0.5 },
  },
  {
    name: "魔夏姫アンルシア",
    id: "rusia",
    type: "ドラゴン",
    status: { HP: 785, MP: 318, atk: 635, def: 447, spd: 555, int: 294 },
    skill: ["氷華大繚乱", "フローズンシャワー", "おぞましいおたけび", "スパークふんしゃ"],
    attribute: {
      1: {
        iceBreak: { keepOnDeath: true, strength: 1 },
        mindBarrier: { keepOnDeath: true },
        demonKingBarrier: { divineDispellable: true },
        spdUp: { strength: 1 },
        powerCharge: { strength: 2 },
        protection: { divineDispellable: true, strength: 0.5, duration: 3 },
        fireGuard: { strength: 50, duration: 4, targetType: "ally" },
      },
    },
    seed: { atk: 45, def: 0, spd: 75, int: 0 },
    ls: { HP: 0.1, spd: 0.1 },
    lstarget: "スライム",
    AINormalAttack: [2],
    resistance: { fire: 0.5, ice: 0, thunder: 0, wind: 1, io: 1, light: 1, dark: 0.5, poisoned: 1, asleep: 1, confused: 0, paralyzed: 0, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "怪竜やまたのおろち",
    id: "orochi",
    type: "ドラゴン",
    status: { HP: 909, MP: 368, atk: 449, def: 675, spd: 296, int: 286 },
    skill: ["むらくもの息吹", "獄炎の息吹", "ほとばしる暗闇", "防刃の守り"],
    attribute: {
      1: {
        fireBreak: { keepOnDeath: true, strength: 2 },
        breathEnhancement: { keepOnDeath: true },
        mindBarrier: { keepOnDeath: true },
        preemptiveAction: { duration: 1 },
      },
      evenTurnBuffs: { slashBarrier: { strength: 1 } },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 100, spd: 100 },
    lstarget: "スライム",
    AINormalAttack: [2, 3],
    resistance: { fire: -1, ice: 1.5, thunder: 0.5, wind: 1, io: 1, light: 1, dark: 0.5, poisoned: 0.5, asleep: 1, confused: 1, paralyzed: 0.5, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 0.5 },
  },
  {
    name: "ヴォルカドラゴン",
    id: "voruka",
    type: "ドラゴン",
    status: { HP: 1025, MP: 569, atk: 297, def: 532, spd: 146, int: 317 },
    skill: ["ラヴァフレア", "におうだち", "大樹の守り", "みがわり"],
    attribute: {
      1: {
        metal: { keepOnDeath: true, strength: 0.75, type: "notmetal" },
        spellBarrier: { strength: 1, targetType: "ally" },
        stonedBlock: { duration: 3, targetType: "ally" },
      },
    },
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 10, MP: 10 },
    lstarget: "all",
    resistance: { fire: -1, ice: 1.5, thunder: 0.5, wind: 0.5, io: 1.5, light: 1, dark: 1, poisoned: 1, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "WORLD",
    id: "world",
    type: "???",
    weight: "30",
    status: { HP: 809, MP: 332, atk: 659, def: 473, spd: 470, int: 324 },
    skill: ["超魔滅光", "真・ゆうきの斬舞", "神獣の封印", "斬撃よそく"],
    attribute: {
      1: {
        lightBreak: { keepOnDeath: true, strength: 2 },
        isUnbreakable: { keepOnDeath: true, left: 1, type: "hukutsu", name: "不屈の闘志" },
        mindBarrier: { keepOnDeath: true },
        martialReflection: { divineDispellable: true, strength: 1.5, duration: 3 },
      },
    },
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1.13, spd: 1.13, atk: 1.05 },
    lstarget: "all",
    AINormalAttack: [2, 3],
    resistance: { fire: 0, ice: 1, thunder: 0.5, wind: 0.5, io: 1, light: -1, dark: 1, poisoned: 1.5, asleep: 0.5, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 0.5, breathSeal: 1 },
  },
  {
    name: "超ネルゲル",
    id: "nerugeru",
    type: "tyoma",
    weight: "40",
    status: { HP: 907, MP: 373, atk: 657, def: 564, spd: 577, int: 366 },
    skill: ["ソウルハーベスト", "黄泉の封印", "暗黒閃", "終の流星"],
    attribute: {
      1: {
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
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 0.5, ice: 0, thunder: 0, wind: 0.5, io: 1, light: 1, dark: 0, poisoned: 1, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "超エルギ",
    id: "erugi",
    type: "tyoma",
    weight: "40",
    status: { HP: 870, MP: 411, atk: 603, def: 601, spd: 549, int: 355 },
    skill: ["失望の光舞", "パニッシュスパーク", "堕天使の理", "終の流星"],
    attribute: {
      1: {
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
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 1, ice: 0, thunder: 0.5, wind: 0.5, io: 0, light: 1, dark: 0, poisoned: 1, asleep: 0, confused: 0, paralyzed: 0.5, zaki: 0, dazzle: 0, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "イフシバ",
    id: "ifshiba",
    type: "???",
    weight: "25",
    status: { HP: 750, MP: 299, atk: 540, def: 385, spd: 461, int: 415 },
    skill: ["ヘルバーナー", "氷魔のダイヤモンド", "炎獣の爪", "プリズムヴェール"],
    attribute: {
      1: {
        tagTransformation: { keepOnDeath: true },
        fireBreak: { keepOnDeath: true, strength: 2 },
        iceBreak: { keepOnDeath: true, strength: 2 },
        mindBarrier: { duration: 3 },
      },
    },
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
    resistance: { fire: -1, ice: -1, thunder: 1, wind: 1, io: 0.5, light: 1, dark: 0.5, poisoned: 0.5, asleep: 0, confused: 0.5, paralyzed: 1, zaki: 0.5, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "スカルナイト",
    id: "skull",
    type: "zombie",
    weight: "8",
    status: { HP: 483, MP: 226, atk: 434, def: 304, spd: 387, int: 281 },
    skill: ["ルカナン", "みがわり", "ザオリク", "防刃の守り"],
    attribute: {
      1: {
        isUnbreakable: { keepOnDeath: true, left: 3, type: "toukon", name: "とうこん" },
      },
    },
    seed: { atk: 20, def: 5, spd: 95, int: 0 },
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
    resistance: { fire: 1.5, ice: 1, thunder: 1, wind: 0.5, io: 1, light: 1, dark: 0, poisoned: 1, asleep: 0, confused: 1, paralyzed: 0.5, zaki: 0.5, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "超オムド",
    id: "omudo",
    type: "tyoma",
    weight: "40",
    status: { HP: 937, MP: 460, atk: 528, def: 663, spd: 263, int: 538 },
    skill: ["タイムストーム", "零時の儀式", "クロノストーム", "かくせいリバース"],
    attribute: "",
    seed: { atk: 30, def: 70, spd: 0, int: 20 },
    ls: { HP: 1.4, spd: 0.8 },
    lstarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 1, ice: 1, thunder: 0, wind: 0, io: 1, light: 1, dark: 0, poisoned: 1, asleep: 0, confused: 0, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "超ラプ",
    id: "rapu",
    type: "tyoma",
    weight: "40",
    status: { HP: 1075, MP: 457, atk: 380, def: 513, spd: 405, int: 559 },
    skill: ["呪いの儀式", "はめつの流星", "暗黒神の連撃", "真・闇の結界"],
    attribute: "",
    seed: { atk: 80, def: 30, spd: 10, int: 0 },
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
    AINormalAttack: [3],
    resistance: { fire: 0, ice: 1, thunder: 1, wind: 1, io: 0, light: 0, dark: 0, poisoned: 0, asleep: 0, confused: 0.5, paralyzed: 0, zaki: 0, dazzle: 1, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "エスターク",
    id: "esta",
    type: "???",
    weight: "32",
    status: { HP: 862, MP: 305, atk: 653, def: 609, spd: 546, int: 439 },
    skill: ["必殺の双撃", "帝王のかまえ", "体砕きの斬舞", "体砕きの斬舞"],
    attribute: "",
    seed: { atk: 100, def: 10, spd: 10, int: 0 },
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
    AINormalAttack: [3, 4],
    resistance: { fire: 0, ice: 0.5, thunder: 1, wind: 0.5, io: 1, light: 1, dark: 0.5, poisoned: 1, asleep: 1.5, confused: 0.5, paralyzed: 0.5, zaki: 0, dazzle: 0, spellSeal: 0, breathSeal: 1 },
  },
  {
    name: "ミステリドール",
    id: "dogu",
    type: "material",
    weight: "16",
    status: { HP: 854, MP: 305, atk: 568, def: 588, spd: 215, int: 358 },
    skill: ["アストロンゼロ", "衝撃波", "みがわり", "防刃の守り"],
    attribute: "",
    seed: { atk: 40, def: 80, spd: 0, int: 0 },
    ls: { HP: 1.15 },
    lstarget: "all",
    resistance: { fire: 1, ice: 1, thunder: 0, wind: 1.5, io: 0, light: 1.5, dark: 1, poisoned: 0, asleep: 0, confused: 0.5, paralyzed: 0.5, zaki: 0, dazzle: 0.5, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "ティトス",
    id: "dorunisu",
    type: "???",
    weight: "14",
    status: { HP: 837, MP: 236, atk: 250, def: 485, spd: 303, int: 290 },
    skill: ["おおいかくす", "闇の紋章", "防刃の守り", "タップダンス"],
    attribute: "",
    seed: { atk: 50, def: 60, spd: 10, int: 0 },
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
    resistance: { fire: 1, ice: 1, thunder: 1, wind: 1, io: 1, light: 1, dark: 0, poisoned: 1, asleep: 0.5, confused: 0.5, paralyzed: 0.5, zaki: 1, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
  {
    name: "sample",
    id: "",
    type: "",
    weight: "",
    status: { HP: 1300, MP: 1300, atk: 1300, def: 1300, spd: 1300, int: 1300 },
    skill: ["", "", "", ""],
    attribute: "",
    seed: { atk: 0, def: 0, spd: 95, int: 0 },
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
    resistance: { fire: 1, ice: 1, thunder: 1, wind: 1, io: 1, light: 1, dark: 1, poisoned: 0, asleep: 0.5, confused: 1, paralyzed: 1, zaki: 0, dazzle: 1, spellSeal: 1, breathSeal: 1 },
  },
];
//ウェイトなども。あと、特技や特性は共通項もあるので別指定も可能。

const skill = [
  {
    name: "なし",
    howToCalculate: "",
    element: "",
  },
  {
    name: "",
    id: "number?",
    type: "", //spell slash martial breath ritual notskill
    howToCalculate: "", //atk int fix def spd
    ratio: 1,
    element: "", //fire ice thunder io wind light dark
    order: "", //preemptive anchor
    preemptivegroup: "num", //1封印の霧,邪神召喚 2マイバリ精霊タップ 3におう 4みがわり 5予測構え 6ぼうぎょ 7全体 8random単体
    targetType: "", //single random all
    targetTeam: "enemy",
    numofhit: "",
    ignoreProtection: true,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreGuard: true,
    ignoreEvasion: true,
    ignoreTypeEvasion: true,
    ignoreDazzle: true,
    penetrateIronize: true,
    ignoreBaiki: true,
    ignoreManaBoost: true,
    ignorePowerCharge: true,
    weakness18: true,
    RaceBane: ["slime", "dragon"],
    RaceBaneValue: 3,
    anchorBonus: 3,
    damageByLevel: true,
    SubstituteBreaker: 3,
    MPcost: 76,
    followingSkill: "ryohuzentai",
    act: function (skillUser, skillTarget) {
      console.log("hoge");
    },
    appliedEffect: { defUp: { strength: -1 } }, //radiantWave divineWave disruptiveWave
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
    name: "ぼうぎょ",
    type: "notskill",
    howToCalculate: "none",
    element: "none",
    targetType: "me",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 6,
    MPcost: 0,
    act: function (skillUser, skillTarget) {
      skillUser.flags.guard = true;
    },
  },
  {
    name: "涼風一陣",
    type: "martial",
    howToCalculate: "fix",
    element: "ice",
    targetType: "all",
    targetTeam: "enemy",
    damage: 142,
    followingSkill: "涼風一陣後半",
    MPcost: 96,
    act: function (skillUser, skillTarget) {
      delete skillTarget.buffs.isUnbreakable;
    },
  },
  {
    name: "涼風一陣後半",
    type: "breath",
    howToCalculate: "fix",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    damage: 420,
    MPcost: 0,
    ignoreProtection: true,
    act: function (skillUser, skillTarget) {
      delete skillTarget.buffs.isUnbreakable;
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
    appliedEffect: "divineWave",
  },
  {
    name: "昇天斬り",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.74,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 35,
  },
  {
    name: "タップダンス",
    type: "dance",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 2,
    MPcost: 30,
    appliedEffect: { dodgeBuff: { strength: 0.5, duration: 1, removeAtTurnStart: true } },
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
    damage: 420,
    appliedEffect: { iceResistance: { strength: -1, probability: 0.57 } },
  },
  {
    name: "フローズンシャワー",
    type: "martial",
    howToCalculate: "fix",
    element: "ice",
    targetType: "single",
    targetTeam: "enemy",
    order: "anchor",
    hitNum: 7,
    damage: 190,
    MPcost: 70,
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
    appliedEffect: { fear: { probability: 0.57 }, confused: { probability: 0.57 } },
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
  },
  {
    name: "天空竜の息吹",
    type: "breath",
    howToCalculate: "fix",
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    damage: 184,
    MPcost: 24,
  },
  {
    name: "エンドブレス",
    type: "breath",
    howToCalculate: "fix",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    damage: 2000,
    MPcost: 250,
  },
  {
    name: "テンペストブレス",
    type: "breath",
    howToCalculate: "fix",
    element: "wind",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 3,
    damage: 369,
    MPcost: 23,
  },
  {
    name: "煉獄火炎",
    type: "breath",
    howToCalculate: "fix",
    damage: 333,
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 68,
    appliedEffect: { fear: { probability: 0.57 } },
  },
  {
    name: "むらくもの息吹",
    type: "breath",
    howToCalculate: "fix",
    damage: 161,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 5,
    MPcost: 35,
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
    weakness18: true,
    MPcost: 30,
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
    appliedEffect: "disruptiveWave",
  },
  {
    name: "防刃の守り",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 2,
    MPcost: 54,
    appliedEffect: { protection: { strength: 0.2, duration: 2 }, slashBarrier: { strength: 1 } },
  },
  {
    name: "ラヴァフレア",
    type: "breath",
    howToCalculate: "fix",
    damage: 732,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    order: "anchor",
    anchorBonus: 3,
    hitNum: 3,
    MPcost: 76,
  },
  {
    name: "におうだち",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 3,
    MPcost: 14,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, skillTarget, true);
    },
  },
  {
    name: "大樹の守り",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 2,
    MPcost: 79,
    appliedEffect: { protection: { strength: 0.5, duration: 2 } },
  },
  {
    name: "みがわり",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    excludeTarget: "me",
    order: "preemptive",
    preemptivegroup: 4,
    MPcost: 5,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, skillTarget);
    },
  },
  {
    name: "超魔滅光",
    followingSkill: "超魔滅光後半",
    type: "martial",
    howToCalculate: "fix",
    damage: 475,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 78,
    RaceBane: ["???", "tyoma"],
    RaceBaneValue: 4,
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
    RaceBane: ["???", "tyoma"],
    RaceBaneValue: 4,
  },
  {
    name: "真・ゆうきの斬舞",
    type: "dance",
    howToCalculate: "atk",
    ratio: 0.91,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    order: "preemptive",
    preemptivegroup: 8,
    hitNum: 6,
    MPcost: 71,
  },
  {
    name: "神獣の封印",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 34,
    appliedEffect: { sealed: {} },
  },
  {
    name: "斬撃よそく",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "me",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 5,
    MPcost: 5,
    appliedEffect: { slashReflection: { type: "yosoku", duration: 1, removeAtTurnStart: true } },
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
    appliedEffect: { reviveBlock: {} },
  },
  {
    name: "黄泉の封印",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    MPcost: 39,
    appliedEffect: { sealed: {}, reviveBlock: { unDispellableByRadiantWave: true } },
  },
  {
    name: "暗黒閃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 3.6,
    element: "dark",
    targetType: "single",
    targetTeam: "enemy",
    order: "preemptive",
    preemptivegroup: 8,
    MPcost: 43,
  },
  {
    name: "冥王の奪命鎌",
    type: "slash",
    howToCalculate: "atk",
    ratio: 1.12,
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    damage: 1,
    MPcost: 52,
    SubstituteBreaker: 3,
  },
  {
    name: "終の流星",
    type: "martial",
    howToCalculate: "fix",
    damage: 580,
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    order: "anchor",
    hitNum: 6,
    MPcost: 79,
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
      delete skillTarget.buffs.isUnbreakable;
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
  },
  {
    name: "堕天使の理",
    type: "dance",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 2,
    MPcost: 50,
    appliedEffect: { dodgeBuff: { strength: 1, duration: 1, removeAtTurnStart: true }, spdUp: { strength: 1 } },
  },
  {
    name: "光速の連打",
    type: "dance",
    howToCalculate: "atk",
    ratio: 0.9,
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 51,
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
    followingSkill: "アイスエイジ",
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
    followingSkill: "地獄の火炎",
  },
  {
    name: "炎獣の爪",
    type: "slash",
    howToCalculate: "atk",
    ratio: 2.15,
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    order: "preemptive",
    preemptivegroup: 8,
    MPcost: 30,
    RaceBane: ["dragon", "???"],
    RaceBaneValue: 2,
    followingSkill: "アイスエイジ",
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
    element: "ice",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 0,
    appliedEffect: { fireResistance: { strength: -1, probability: 0.58 } },
  },
  {
    name: "プリズムヴェール",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    MPcost: 54,
  },
  {
    name: "ルカナン",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    MPcost: 18,
  },
  {
    name: "ザオリク",
    type: "spell",
    howToCalculate: "none",
    element: "none",
    targetType: "dead",
    targetTeam: "ally",
    MPcost: 103,
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
    preemptivegroup: 7,
    MPcost: 120,
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
    order: "preemptive",
    preemptivegroup: 8,
    MPcost: 85,
  },
  {
    name: "かくせいリバース",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "anchor",
    MPcost: 60,
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
  },
  {
    name: "はめつの流星",
    type: "spell",
    howToCalculate: "int",
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 88,
  },
  {
    name: "暗黒神の連撃",
    type: "martial",
    howToCalculate: "fix",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    order: "anchor",
    hitNum: 3,
    MPcost: 80,
  },
  {
    name: "真・闇の結界",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "me",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 5,
    MPcost: 38,
  },
  {
    name: "必殺の双撃",
    type: "slash",
    howToCalculate: "atk",
    ratio: 4.6,
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    hitNum: 2,
    MPcost: 100,
    act: function (skillUser, skillTarget) {
      delete skillTarget.buffs.isUnbreakable;
    },
  },
  {
    name: "帝王のかまえ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "me",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 5,
    MPcost: 37,
  },
  {
    name: "体砕きの斬舞",
    type: "dance",
    howToCalculate: "atk",
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    hitNum: 6,
    MPcost: 41,
  },
  {
    name: "アストロンゼロ",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "me",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 5,
    MPcost: 52,
  },
  {
    name: "衝撃波",
    type: "martial",
    howToCalculate: "atk",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    order: "anchor",
    MPcost: 38,
  },
  {
    name: "おおいかくす",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 3,
    MPcost: 16,
    act: function (skillUser, skillTarget) {
      applySubstitute(skillUser, skillTarget, false, true);
    },
  },
  {
    name: "闇の紋章",
    type: "martial",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    following: "", //敵にも付与
    MPcost: 53,
  },
  {
    name: "物質の爆発",
    type: "martial",
    howToCalculate: "fix",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    skipDeathCheck: true,
    skipAbnormalityCheck: true,
    damage: 100,
    trigger: "death",
    ignoreBaiki: true,
    ignorePowerCharge: true,
    MPcost: 0,
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
    name: "邪道のかくせい",
    howToCalculate: "none",
    element: "none",
  },
  {
    name: "絶氷の嵐",
    howToCalculate: "int",
    element: "ice",
  },

  {},
];

const gear = [
  {
    name: "",
    id: "ungeared",
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 0 },
    effect: "none",
  },
  {
    name: "メタ爪",
    id: "metanail",
    status: { HP: 0, MP: 0, atk: 15, def: 0, spd: 56, int: 0 },
    effect: "none",
  },
  {
    name: "竜神爪",
    id: "ryujinnail",
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 42, int: 0 },
    effect: "none",
  },
  {
    name: "砕き",
    id: "kudaki",
    status: { HP: 0, MP: 0, atk: 22, def: 0, spd: 15, int: 0 },
    effect: "none",
  },
  {
    name: "昇天",
    id: "shoten",
    status: { HP: 0, MP: 0, atk: 23, def: 0, spd: 0, int: 28 },
    effect: "none",
  },

  {},
]; //finish gear

document.getElementById("preActionbtn").addEventListener("click", function () {
  const preActiondetector = document.getElementById("preActionbtn").textContent;
  if (preActiondetector === "味方神速") {
    document.getElementById("preActionbtn").textContent = "4のみ";
    parties[0][0].buffs.preemptiveAction = 100;
    parties[0][1].buffs.preemptiveAction = 100;
    parties[0][2].buffs.preemptiveAction = 100;
    parties[0][3].buffs.preemptiveAction = 100;
    parties[0][4].buffs.preemptiveAction = 100;
  } else {
    document.getElementById("preActionbtn").textContent = "味方神速";
    for (const party of parties) {
      for (const monster of party) {
        delete monster.buffs.preemptiveAction;
      }
    }
    if (parties[0] && parties[0][3]) {
      parties[0][3].buffs.preemptiveAction = 100;
    }
  }
  decideTurnOrder(parties, skill);
});

document.getElementById("elementErrorbtn").addEventListener("click", function () {
  const elementErrortext = document.getElementById("elementErrorbtn").textContent;
  if (elementErrortext === "エレエラ") {
    document.getElementById("elementErrorbtn").textContent = "エラ解除";
    fieldState.isDistorted = true;
  } else {
    document.getElementById("elementErrorbtn").textContent = "エレエラ";
    delete fieldState.isDistorted;
  }
});

document.getElementById("Reversebtn").addEventListener("click", function () {
  const reversedetector = document.getElementById("Reversebtn").textContent;
  if (reversedetector === "リバース化") {
    document.getElementById("Reversebtn").textContent = "リバース解除";
    fieldState.isReverse = true;
  } else {
    document.getElementById("Reversebtn").textContent = "リバース化";
    fieldState.isReverse = false;
  }
  decideTurnOrder(parties, skill);
});

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

function displayDamage(monster, damage, resistance, MP) {
  const monsterIcon = document.getElementById(monster.iconElementId);

  if (damage === 0) {
    if (resistance === -1) {
      // 回復でダメージが0の場合は、回復効果画像と数字0を表示
      const damageContainer = document.createElement("div");
      damageContainer.style.position = "absolute";
      damageContainer.style.display = "flex";
      damageContainer.style.top = "50%";
      damageContainer.style.left = "50%";
      damageContainer.style.transform = "translate(-50%, -50%)";
      damageContainer.style.justifyContent = "center";

      const effectImagePath = MP ? "images/systems/effectImages/MPRecovery.png" : "images/systems/effectImages/HPRecovery.png"; // MP回復かHP回復か

      const effectImage = document.createElement("img");
      effectImage.src = effectImagePath;
      effectImage.style.position = "absolute";
      effectImage.style.width = monsterIcon.offsetWidth + "px";
      effectImage.style.height = monsterIcon.offsetHeight + "px";
      effectImage.style.top = monsterIcon.offsetTop + "px";
      effectImage.style.left = monsterIcon.offsetLeft + "px";

      monsterIcon.parentElement.appendChild(effectImage);
      monsterIcon.parentElement.appendChild(damageContainer);

      const digitImage = document.createElement("img");
      digitImage.src = MP ? "images/systems/MPRecoveryNumbers/0.png" : "images/systems/HPRecoveryNumbers/0.png"; // 数字0の画像
      digitImage.style.maxWidth = "60%";
      digitImage.style.height = "auto";
      digitImage.style.marginLeft = "-1.5px";
      digitImage.style.marginRight = "-1.5px";
      damageContainer.appendChild(digitImage);

      // 各数字のアニメーションを設定
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
      }, 0);

      // 表示を消去
      setTimeout(() => {
        effectImage.remove();
        damageContainer.remove();
      }, 0 + 90 + 140);
    } else {
      // ダメージでダメージが0の場合はmissを表示
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
    }
  } else {
    // ダメージが0以外の場合は、ダメージ画像と数値を表示
    // ダメージ効果画像と数値画像をまとめるコンテナを作成
    const damageEffectContainer = document.createElement("div");
    damageEffectContainer.style.position = "absolute";
    damageEffectContainer.style.top = "50%";
    damageEffectContainer.style.left = "50%";
    damageEffectContainer.style.transform = "translate(-50%, -50%)";

    const damageContainer = document.createElement("div");
    damageContainer.style.position = "relative";
    damageContainer.style.display = "flex";
    damageContainer.style.justifyContent = "center";

    // ダメージ/回復効果画像を設定
    let effectImagePath = "";
    if (resistance === -1) {
      // 回復の場合
      effectImagePath = MP ? "images/systems/effectImages/MPRecovery.png" : "images/systems/effectImages/HPRecovery.png";
    } else {
      // ダメージの場合
      effectImagePath = MP ? "images/systems/effectImages/MPDamaged.png" : monster.teamID === 0 ? "images/systems/effectImages/allyDamaged.png" : "images/systems/effectImages/enemyDamaged.png";

      // 耐性によって画像を変更 (HPダメージの場合のみ)
      if (!MP) {
        if (resistance === 1.5) {
          effectImagePath = monster.teamID === 0 ? "images/systems/effectImages/allyDamagedWeakness.png" : "images/systems/effectImages/enemyDamagedWeakness.png";
        } else if (resistance === 2) {
          effectImagePath = monster.teamID === 0 ? "images/systems/effectImages/allyDamagedSuperWeakness.png" : "images/systems/effectImages/enemyDamagedSuperWeakness.png";
        } else if (resistance === 2.5) {
          effectImagePath = monster.teamID === 0 ? "images/systems/effectImages/allyDamagedUltraWeakness.png" : "images/systems/effectImages/enemyDamagedUltraWeakness.png";
        }
      }
    }

    const effectImage = document.createElement("img");
    effectImage.src = effectImagePath;
    effectImage.style.position = "absolute";
    let scale = 1;
    if (resistance > 1.4) {
      scale = 2;
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
          ? MP
            ? `images/systems/MPRecoveryNumbers/${digits[i]}.png`
            : `images/systems/HPRecoveryNumbers/${digits[i]}.png`
          : MP
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

document.getElementById("revivebtn").addEventListener("click", function () {
  for (const party of parties) {
    for (const monster of party) {
      monster.currentstatus.HP = 200;
      delete monster.flags.recentlyKilled;
      delete monster.flags.beforeDeathActionCheck;
      delete monster.flags.hasDiedThisAction;
      delete monster.flags.isDead;
      delete monster.flags.isZombie;
      delete monster.flags.isRecentlyDamaged;
      applyDamage(monster, -1500, -1);
      applyDamage(monster, -1500, -1, true);
      updatebattleicons(monster);
      displayMessage("ザオリーマをとなえた");
    }
  }
  preparebattle();
});

document.getElementById("hametsubtn").addEventListener("click", function () {
  for (const party of parties) {
    for (const monster of party) {
      monster.currentstatus.HP = 100;
      applyDamage(monster, 5, 1);
      updatebattleicons(monster);
      monster.buffs.isUnbreakable = { keepOnDeath: true, left: 3, type: "toukon", name: "とうこん" };
    }
  }
  parties[0][0].buffs.isUnbreakable = { keepOnDeath: true, left: 3, name: "ラストスタンド" };
  displayMessage("とうこんを付与したよ");
});

document.getElementById("flobtn").addEventListener("click", function () {
  executeSkill(parties[0][2], findSkillByName("フローズンシャワー"), parties[1][0]);
});

document.getElementById("materialbtn").addEventListener("click", function () {
  for (const party of parties) {
    for (const monster of party) {
      monster.abilities.explode = {
        trigger: "death",
        // act 関数を async function として定義
        act: async function (monster) {
          console.log(`${monster.name}は爆発した`);
          displayMessage(`${monster.name}は爆発した！`);
          await executeSkill(monster, findSkillByName("物質の爆発")); // await を使って executeSkill の完了を待つ
        },
      };
      monster.abilities.explode.act = monster.abilities.explode.act.bind(monster);
    }
  }
  displayMessage("爆発するよ");
});

document.getElementById("rezaobtn").addEventListener("click", function () {
  for (const monster of parties[1]) {
    monster.buffs.Revive = { keepOnDeath: true, strength: 0.5 };
  }
  displayMessage("リザオ付与");
});
document.getElementById("harvestbtn").addEventListener("click", function () {
  executeSkill(parties[0][0], findSkillByName("ソウルハーベスト"), parties[1][1]);
});
document.getElementById("endbtn").addEventListener("click", function () {
  executeSkill(parties[0][1], findSkillByName("エンドブレス"), parties[1][0]);
});

const messageLine1 = document.getElementById("message-line1");
const messageLine2 = document.getElementById("message-line2");

function displayMessage(line1Text, line2Text = "", centerText = false) {
  messageLine1.textContent = line1Text;
  messageLine2.textContent = line2Text;
  if (centerText) {
    // 第三引数がtrueの場合、中央揃えのスタイルを適用し、文字を大きくする
    consolescreen.style.justifyContent = "center";
    messageLine1.style.textAlign = "center";
    messageLine1.style.fontSize = "1.05rem";
  } else {
    consolescreen.style.justifyContent = "space-between";
    messageLine1.style.textAlign = "";
    messageLine1.style.fontSize = "0.9rem";
  }
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

const imageCache = {};
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

// 各モンスターのバフ表示を管理するオブジェクト
let buffDisplayTimers = {};

async function updateMonsterBuffsDisplay(monster, isReversed = false) {
  // 前回のタイマーをクリア
  if (buffDisplayTimers[monster.monsterId]) {
    clearTimeout(buffDisplayTimers[monster.monsterId]);
    buffDisplayTimers[monster.monsterId] = null;
  }

  let wrapper = document.getElementById(monster.iconElementId).parentElement;
  if (isReversed) {
    // monster.iconElementId を入れ替える
    const newId = monster.iconElementId.includes("ally") ? monster.iconElementId.replace("ally", "enemy") : monster.iconElementId.replace("enemy", "ally");

    // wrapper を新しい要素の親要素に置き換える
    wrapper = document.getElementById(newId).parentElement;
  }

  // buffContainerを初回のみ生成
  let buffContainer = wrapper.querySelector(".buff-container");
  if (!buffContainer) {
    buffContainer = document.createElement("div");
    buffContainer.classList.add("buff-container");
    wrapper.appendChild(buffContainer);
  }

  // buffIconを初回のみ生成
  let buffIcons = buffContainer.querySelectorAll(".buff-icon");
  if (buffIcons.length === 0) {
    for (let i = 0; i < 3; i++) {
      const buffIcon = document.createElement("img");
      buffIcon.classList.add("buff-icon");
      buffContainer.appendChild(buffIcon);
      buffIcons = buffContainer.querySelectorAll(".buff-icon"); // 再取得
    }
  }

  if (monster.flags.isDead) {
    // isDeadの場合は、すべてのbuffIconを非表示にする
    buffIcons.forEach((icon) => (icon.style.display = "none"));
    return;
  }

  // 画像が存在するバフのデータのみを格納する配列
  const activeBuffs = [];
  for (const buffKey in monster.buffs) {
    // 基本のアイコンパス
    let iconSrc = `images/buffIcons/${buffKey}.png`;

    // keepOnDeath, divineDispellable, unDispellableByRadiantWave, strength の順に確認し、
    // 対応するアイコンが存在すればパスを更新
    const buffAttributes = ["keepOnDeath", "divineDispellable", "unDispellableByRadiantWave", "strength"];
    for (const prop of buffAttributes) {
      if (monster.buffs[buffKey][prop] !== undefined) {
        const tempSrc = `images/buffIcons/${buffKey}${prop === "strength" ? "str" + monster.buffs[buffKey][prop] : prop}.png`;
        if (await imageExists(tempSrc)) {
          iconSrc = tempSrc;
          break;
        }
      }
    }

    // 画像が存在する場合は、activeBuffsにバフデータを追加
    if (await imageExists(iconSrc)) {
      activeBuffs.push({ key: buffKey, src: iconSrc });
    }
  }

  //みがわりアイコンをpush
  if (monster.flags.hasSubstitute) {
    activeBuffs.push({ key: "hasSubstitute", src: "images/buffIcons/hasSubstitute.png" });
  }
  if (monster.flags.isSubstituting) {
    activeBuffs.push({ key: "isSubstituting", src: "images/buffIcons/isSubstituting.png" });
  }

  if (activeBuffs.length === 0) {
    // バフがない場合は、すべてのbuffIconを非表示にする
    buffIcons.forEach((icon) => (icon.style.display = "none"));
    return;
  }

  let buffIndex = 0;

  function showNextBuffs() {
    console.log("実行");
    buffIcons.forEach((icon) => (icon.style.display = "none"));

    const startIndex = buffIndex * 3;
    const buffsToShow = activeBuffs.slice(startIndex, startIndex + 3);

    buffsToShow.forEach((buff, index) => {
      const buffIcon = buffIcons[index];
      buffIcon.src = buff.src;
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

//光の波動 dispellableByRadiantWave指定以外を残す
function executeRadiantWave(monster) {
  monster.buffs = Object.fromEntries(Object.entries(monster.buffs).filter(([key, value]) => !value.dispellableByRadiantWave));
  updateCurrentStatus(monster);
  updateMonsterBuffsDisplay(monster);
}

//かみは 解除不可以上 光の波動の対象 を残す
function executeDivineWave(monster) {
  const keepKeys = ["powerCharge", "manaBoost", "breathCharge"];
  monster.buffs = Object.fromEntries(
    Object.entries(monster.buffs).filter(([key, value]) => keepKeys.includes(key) || value.keepOnDeath || value.unDispellable || value.dispellableByRadiantWave || value.unDispellableByRadiantWave)
  );
  updateCurrentStatus(monster);
  updateMonsterBuffsDisplay(monster);
}

//いては
function executeDisruptiveWave(monster) {
  const keepKeys = ["powerCharge", "manaBoost", "breathCharge"];
  monster.buffs = Object.fromEntries(
    Object.entries(monster.buffs).filter(
      ([key, value]) => keepKeys.includes(key) || value.keepOnDeath || value.unDispellable || value.dispellableByRadiantWave || value.unDispellableByRadiantWave || value.divineDispellable
    )
  );
  updateCurrentStatus(monster);
  updateMonsterBuffsDisplay(monster);
}

//みがわり付与
function applySubstitute(skillUser, skillTarget, isAll = false, isCover = false) {
  if (isAll) {
    //自分以外に身代わりisSubstitutingがあるときはreturn hasだと仁王連続処理が初回で止まる
    for (const monster of parties[skillUser.teamID]) {
      if (monster.flags.isSubstituting && monster.index !== skillUser.index) {
        return;
      }
    }
    //自分自身は仁王立ちの対象にしない
    if (skillTarget.index == skillUser.index) {
      return;
    }
  }
  skillTarget.flags.hasSubstitute = {};
  skillTarget.flags.hasSubstitute.targetMonsterId = skillUser.monsterId;
  if (!skillUser.flags.hasOwnProperty("isSubstituting")) {
    skillUser.flags.isSubstituting = {};
    skillUser.flags.isSubstituting.targetMonsterId = [];
  }
  skillUser.flags.isSubstituting.targetMonsterId.push(skillTarget.monsterId);
  if (isCover) {
    skillTarget.flags.hasSubstitute.cover = true;
    skillUser.flags.isSubstituting.cover = true;
  }
}

function preloadImages() {
  const imageUrls = [
    "images/systems/miss.png",
    "images/systems/effectImages/allyDamagedSuperWeakness.png",
    "images/systems/effectImages/allyDamagedUltraWeakness.png",
    "images/systems/effectImages/allyDamagedWeakness.png",
    "images/systems/effectImages/enemyDamaged.png",
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
  ];
  imageUrls.forEach((imageUrl) => {
    const img = new Image();
    img.src = imageUrl;
  });
}

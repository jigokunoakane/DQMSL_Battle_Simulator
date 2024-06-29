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
//defaultpartyにmonster5体を格納
/*let allparties = [
  { party: [...defaultparty] }10
];
*/
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
  }
}

//パテ設定画面の確定で起動
function preparebattle() {
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
      monster.buffs = [];
      monster.abnormalities = [];
      monster.flags = [];
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

      // オブジェクトにIDを追加
      monster.iconElementId = iconId;
      monster.hpBarElementId = hpBarId;
      monster.mpBarElementId = mpBarId;
    }
  }

  updateHPMPdisplay();
  //戦闘画面の10のimgのsrcを設定
  //partyの中身のidとgearidから、適切な画像を設定
  preparebattlepageicons(1, 0);
  //コマンド選択段階判定変数の初期化と、最初のモンスターをstickout、他からclass削除
  backbtn();
  //field管理用変数の導入はglobalで
  startTurn(1);
}
//finish preparebattle 開始時処理終了

const fieldState = [];

//戦闘開始時の10のアイコン更新と、targetTeamごとに特技target選択画面で起動
function updatebattleicons(elementId, id) {
  const iconSrc = "images/icons/" + id + ".jpeg";
  document.getElementById(elementId).src = iconSrc;
}

//prepare、コマンド選択時に起動
function preparebattlepageicons(top, bottom) {
  //(1,0)が通常、(0,1)が逆、敵コマンド入力時に一時的に反転
  updatebattleicons("battleiconenemy0", parties[top][0].id);
  updatebattleicons("battleiconenemy1", parties[top][1].id);
  updatebattleicons("battleiconenemy2", parties[top][2].id);
  updatebattleicons("battleiconenemy3", parties[top][3].id);
  updatebattleicons("battleiconenemy4", parties[top][4].id);
  updatebattleicons("battleiconally0", parties[bottom][0].id);
  updatebattleicons("battleiconally1", parties[bottom][1].id);
  updatebattleicons("battleiconally2", parties[bottom][2].id);
  updatebattleicons("battleiconally3", parties[bottom][3].id);
  updatebattleicons("battleiconally4", parties[bottom][4].id);
}

//HPMPのテキスト表示とバーを更新する これは戦闘開始時と毎ダメージ処理後、applydamage内で起動
function updateHPMPdisplay(target, damage, oldHP) {
  document.getElementById("hpbartextally0").textContent = parties[0][0].currentstatus.HP;
  document.getElementById("hpbartextally1").textContent = parties[0][1].currentstatus.HP;
  document.getElementById("hpbartextally2").textContent = parties[0][2].currentstatus.HP;
  document.getElementById("hpbartextally3").textContent = parties[0][3].currentstatus.HP;
  document.getElementById("hpbartextally4").textContent = parties[0][4].currentstatus.HP;
  document.getElementById("mpbartextally0").textContent = parties[0][0].currentstatus.MP;
  document.getElementById("mpbartextally1").textContent = parties[0][1].currentstatus.MP;
  document.getElementById("mpbartextally2").textContent = parties[0][2].currentstatus.MP;
  document.getElementById("mpbartextally3").textContent = parties[0][3].currentstatus.MP;
  document.getElementById("mpbartextally4").textContent = parties[0][4].currentstatus.MP;
  //textの調整
  /*
  const hpPercent = (target.currentHP / target.defaultHP) * 100;
  target - 
  const targetbar = hpbarinnerenemy + targetbarnum;

  
  //enemyのHP
  const hpPercent = (targetbar.currentHP / targetbar.defaultHP) * 100;
  const mpPercent = (monster.currentMP / monster.defaultMP) * 100;

  const targetbar = hpbarinnerenemy + targetbarnum;
  hpBar.style.width = hpPercent + '%';
  mpBar.style.width = mpPercent + '%';
  
  //allyのHPMP
*/
}

function applydamage(target, damage) {
  const oldHP = target.currentstatus.HP;
  //退避して送る
  //くじけぬ処理
  //targetのcurrentからdamageを引く
  //死亡確認、死んでたらdeathflagを付与して死亡時処理も
  //currentHPを更新
  //表示更新
  updateHPMPdisplay(target, damage, oldHP);
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
}

function selectcommand(selectedskillnum) {
  document.getElementById("selectskillbtns").style.visibility = "hidden";
  const selectedskillname = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[selectedskillnum];
  parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommand = selectedskillname;
  //confirmedcommandに格納
  const selectedskill = findSkillByName(selectedskillname);
  //nameを取得してconfirmedcommandに保存
  const skilltargetTypedetector = selectedskill.targetType;
  const skilltargetTeamdetector = selectedskill.targetTeam;
  //nameからskill配列を検索、targetTypeとtargetTeamを引いてくる
  if (skilltargetTypedetector === "random" || skilltargetTypedetector === "single" || skilltargetTypedetector === "dead") {
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
    //targetがallのとき、all(yesno)画面を起動
    document.getElementById("selectcommandpopupwindow-text").style.visibility = "hidden";
    //allならmonster名は隠すのみ
    document.getElementById("designateskilltarget-all-text").textContent = selectedskillname + "を使用しますか？";
    document.getElementById("designateskilltarget-all").style.visibility = "visible";
    /*parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommandtarget = "all";*/
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
  updatebattleicons("selecttargetmonster0", parties[targetTeamnum][0].id);
  updatebattleicons("selecttargetmonster1", parties[targetTeamnum][1].id);
  updatebattleicons("selecttargetmonster2", parties[targetTeamnum][2].id);
  updatebattleicons("selecttargetmonster3", parties[targetTeamnum][3].id);
  updatebattleicons("selecttargetmonster4", parties[targetTeamnum][4].id);

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

//allでyes選択時、skilltarget選択後、ぼうぎょ選択、target:me選択後に起動。次のmosnterのskill選択に移行する
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
    // スキル選択ポップアップを閉じる
    document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
    // コマンドボタンを有効化
    disablecommandbtns(false);
  }
}

//allのyesbtnと、skilltarget選択後に起動する場合、+=1された次のモンスターをstickout
//backbtnとpreparebattleで起動する場合、-1された相手もしくは0の状態でstickout
//一旦全削除用function、コマンド選択終了時にも起動
function removeallstickout() {
  const allmonstericonsstickout = document.querySelectorAll(".battlepageallyicon");
  allmonstericonsstickout.forEach((monstericon) => {
    monstericon.classList.remove("stickout");
  });
}
//現在選択中のmonster imgにclass:stickoutを付与
function adjustmonstericonstickout() {
  removeallstickout();
  const targetmonstericonstickout = document.getElementById(`battleiconally${selectingwhichmonsterscommand}`);
  targetmonstericonstickout.classList.add("stickout");
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
}

// 閉じるボタンにイベントリスナー追加
document.getElementById("closeselectcommandpopupwindowbtn").addEventListener("click", closeSelectCommandPopupWindowContents);

function disablecommandbtns(trueorfalse) {
  document.querySelectorAll(".commandbtn").forEach((button) => {
    button.disabled = trueorfalse;
  });
}

//コマンド選択を終了しますか
function askfinishselectingcommand() {
  document.getElementById("askfinishselectingcommand").style.visibility = "visible";
  document.getElementById("selectcommandpopupwindow").style.visibility = "visible"; //最後が防御の場合に枠を新規表示
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
});

//コマンド選択終了画面でyes選択時、コマンド選択を終了
document.getElementById("askfinishselectingcommandbtnyes").addEventListener("click", function () {
  document.getElementById("askfinishselectingcommand").style.visibility = "hidden";
  if (selectingwhichteamscommand == "1") {
    //敵も選択終了後は、startbattleへ
    selectingwhichmonsterscommand = 0;
    selectingwhichteamscommand = 0;
    //初期化
    document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
    disablecommandbtns(true);
    //popupを閉じ、commandbtnsを無効化
    preparebattlepageicons(1, 0);
    //反転を戻す
    removeallstickout();
    startbattle();
  } else {
    //味方選択のみ終了時はyesno選択画面を閉じ、敵のコマンド選択方法選択画面を表示
    document.getElementById("howtoselectenemyscommand").style.visibility = "visible";
  }
});

//敵のコマンド選択方法-player
document.getElementById("howtoselectenemyscommandbtn-player").addEventListener("click", function () {
  // 敵モンスターの状態を確認
  if (isPartyIncapacitated(1)) {
    // 敵モンスターが全員行動不能の場合
    skipAllMonsterCommandSelection(1);
    askfinishselectingcommand();
    disablecommandbtns(true);
    document.getElementById("askfinishselectingcommandbtnno").disabled = true;
    document.getElementById("closeselectcommandpopupwindowbtn").disabled = true;
  } else {
    // そうでない場合、通常の処理を続行
    selectingwhichmonsterscommand = 0;
    selectingwhichteamscommand = 1;
    document.getElementById("howtoselectenemyscommand").style.visibility = "hidden";
    document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
    //以下、手動選択のための処理
    disablecommandbtns(false);
    //アイコン反転
    preparebattlepageicons(0, 1);
    adjustmonstericonstickout();
  }
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

// 指定されたパーティーのモンスターが全員行動不能かどうか判定する関数
function isPartyIncapacitated(partyIndex) {
  return parties[partyIndex].every((monster) => isDead(monster) || hasAbnormality(monster));
}

// 指定されたパーティーのすべてのモンスターの行動をスキップする関数
function skipAllMonsterCommandSelection(partyIndex) {
  parties[partyIndex].forEach((monster) => {
    if (isDead(monster)) {
      monster.confirmedcommand = "skipThisTurn";
    } else if (hasAbnormality(monster)) {
      monster.confirmedcommand = "normalAICommand";
    }
  });
}

//ターン開始時処理、毎ラウンド移行時とpreparebattleから起動
function startTurn(turnNum) {
  //modifiedSpeed生成 ラウンド開始時に毎ターン起動 行動順生成はコマンド選択後
  for (const party of parties) {
    for (const monster of party) {
      monster.modifiedSpeed = calculateModifiedSpeed(monster);
    }
  }
  //コマンド選択の用意 Todo:実際は開始時特性等の演出終了後に実行
  closeSelectCommandPopupWindowContents();

  if (isPartyIncapacitated(0)) {
    // 味方モンスターが全員行動不能の場合
    skipAllMonsterCommandSelection(0);
    askfinishselectingcommand();
    disablecommandbtns(true);
    document.getElementById("askfinishselectingcommandbtnno").disabled = true;
    document.getElementById("closeselectcommandpopupwindowbtn").disabled = true;
  }
}

//毎ラウンドコマンド選択後処理
function startbattle() {
  console.log(parties);
  decideTurnOrder(parties, skill);
  //1round目なら戦闘開始時flagを持つ特性等を発動
  //ラウンド開始時flagを持つ特性を発動
  //特技の発動
}

//バフ管理system

// ターン終了時の処理
function endTurn() {
  //各モンスターのバフを更新
  for (const party of parties) {
    for (const monster of party) {
      //バフ削除処理において、ループ中に monster.buffs を直接操作するとインデックスがずれてしまう問題を避けるため浅いcopy
      const currentBuffs = [...monster.buffs];
      for (let i = 0; i < currentBuffs.length; i++) {
        const buff = currentBuffs[i];
        buff.duration--; //持続時間を1減らす
        if (buff.duration <= 0) {
          //持続時間が0以下になったらバフを削除
          monster.buffs.splice(monster.buffs.indexOf(buff), 1);
          //indexOf(buff) で、削除対象のバフのindex取得後、splice(index, 1) で、指定indexから1要素を削除

          // バフの効果を打ち消す処理 (別途)
          // 例: buff.effectType によって処理を分岐
        }
      }
    }
  }
  //他の処理
  // 各モンスターの currentstatus を更新
  for (const party of parties) {
    for (const monster of party) {
      updateCurrentStatus(monster);
    }
  }
}

//バフ追加用関数
function addBuff(monster, name, canRemove, strength, duration) {
  // バフが既に存在し、strengthが現在のバフより小さい場合は何もしない
  if (monster.buffs[name] && monster.buffs[name].strength >= strength) {
    return;
  }

  // バフが存在しない、またはstrengthが現在のバフより大きい場合は上書き
  monster.buffs[name] = {
    canRemove: canRemove,
    strength: strength,
    duration: duration,
  };

  updateCurrentStatus(monster); // バフ追加後に該当monsterのcurrentstatusを更新
}

// 各モンスターの全バフと状態異常のdurationを1減らす関数 turnが進んだら起動
function decreaseBuffDurations(monster) {
  monster.buffs.forEach((buff) => {
    buff.duration--;
  });
  monster.abnormalities.forEach((eachabnormality) => {
    eachabnormality.duration--;
  });
}
//これ上に持っていくけど、その前に更新

// durationが0になったバフを消去する関数 skill使用前に起動
function removeExpiredBuffs(monster) {
  monster.buffs = monster.buffs.filter((buff) => buff.duration > 0);
  monster.abnormalities = monster.abnormalities.filter((eachabnormality) => eachabnormality.duration > 0);
  updateCurrentStatus(monster); // バフ更新後に該当monsterのcurrentstatusを更新
}

// currentstatusを更新する関数
//buff追加時・解除時・持続時間切れ時に起動
function updateCurrentStatus(monster) {
  // currentstatus を defaultstatus の値で初期化
  monster.currentstatus = structuredClone(monster.defaultstatus);

  // バフの効果を適用
  for (const buff of monster.buffs) {
    switch (buff.name) {
      case "攻撃力アップ":
        monster.currentstatus.atk = Math.ceil(monster.currentstatus.atk * buff.strength);
        break;
      case "素早さアップ":
        monster.currentstatus.spd = Math.ceil(monster.currentstatus.spd * buff.strength);
        break;
      // 他のバフ効果もここに追加
    }
  }
}

// 使用例
/*
const monsterA = parties[0][0]; 
addBuff(monsterA, "攻撃力アップ", 1.5, 3); // 攻撃力1.5倍、3ターンのバフを追加
console.log(monsterA.currentstatus.攻撃力); // バフ適用後の攻撃力
*/

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
    } else if (monster.preemptiveAction) {
      preemptiveActionMonsters.push(monster);
    } else if (monster.anchorAction) {
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
      ...anchorMonsters.filter((monster) => monster.anchorAction).sort((a, b) => (a?.currentstatus?.spd || 0) - (b?.currentstatus?.spd || 0)),
      ...anchorMonsters.filter((monster) => !monster.anchorAction && !monster.preemptiveAction).sort((a, b) => a.modifiedSpeed - b.modifiedSpeed),
      ...anchorMonsters.filter((monster) => monster.preemptiveAction).sort((a, b) => (a?.currentstatus?.spd || 0) - (b?.currentstatus?.spd || 0))
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
      ...anchorMonsters.filter((monster) => monster.preemptiveAction).sort((a, b) => (b?.currentstatus?.spd || 0) - (a?.currentstatus?.spd || 0)),
      ...anchorMonsters.filter((monster) => !monster.anchorAction && !monster.preemptiveAction).sort((a, b) => b.modifiedSpeed - a.modifiedSpeed),
      ...anchorMonsters.filter((monster) => monster.anchorAction).sort((a, b) => (b?.currentstatus?.spd || 0) - (a?.currentstatus?.spd || 0))
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
// 行動順を出力

//const turnOrder = decideTurnOrder(parties, skills);

//todo:死亡時や蘇生時、攻撃ダメージmotionのアイコン調整も
/*

順番に特技発動、一発づつ処理
hit処理、ダメージ処理、ダメージや死亡に対する処理、バトル終了フラグ確認のループ
すべての行動が終わったら、コマンドに戻る

ラウンド管理システム
*/
///////////////////////////////////////////////
///////////////////////////////////////////////

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

/*
select変化時、全部の合計値を算出、
120-その合計値を算出 = remain
すべてのselectで、現状の値+remainを超える選択肢をdisable化
*/

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
    status: { HP: 700, MP: 700, atk: 700, def: 700, spd: 530, int: 700 },
    skill: ["天空竜の息吹", "エンドブレス", "テンペストブレス", "煉獄火炎"],
    attribute: "",
    seed: { atk: 0, def: 0, spd: 0, int: 0 },
    ls: { HP: 1.3, spd: 1.3 },
    lstarget: "ドラゴン",
  },
  {
    name: "宵の華シンリ",
    id: "sinri",
    type: "ドラゴン",
    status: { HP: 772, MP: 365, atk: 293, def: 341, spd: 581, int: 483 },
    skill: ["涼風一陣", "神楽の術", "昇天斬り", "タップダンス"],
    attribute: "",
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1, spd: 1 },
    lstarget: "ドラゴン",
  },
  {
    name: "魔夏姫アンルシア",
    id: "rusia",
    type: "ドラゴン",
    status: { HP: 1000, MP: 1000, atk: 1000, def: 1000, spd: 555, int: 1000 },
    skill: ["氷華大繚乱", "フローズンシャワー", "おぞましいおたけび", "スパークふんしゃ"],
    attribute: "",
    seed: { atk: 45, def: 0, spd: 75, int: 0 },
    ls: { HP: 0.1, spd: 0.1 },
    lstarget: "スライム",
  },
  {
    name: "怪竜やまたのおろち",
    id: "orochi",
    type: "ドラゴン",
    status: { HP: 500, MP: 500, atk: 500, def: 500, spd: 380, int: 500 },
    skill: ["むらくもの息吹", "獄炎の息吹", "ほとばしる暗闇", "防刃の守り"],
    attribute: "",
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 100, spd: 100 },
    lstarget: "スライム",
  },
  {
    name: "ヴォルカドラゴン",
    id: "voruka",
    type: "ドラゴン",
    status: { HP: 1300, MP: 1300, atk: 1300, def: 1300, spd: 100, int: 1300 },
    skill: ["ラヴァフレア", "におうだち", "大樹の守り", "みがわり"],
    attribute: "",
    seed: { atk: 0, def: 0, spd: 0, int: 0 },
    ls: { HP: 10, MP: 10 },
    lstarget: "all",
  },
  {
    name: "WORLD",
    id: "world",
    type: "???",
    weight: "30",
    status: { HP: 809, MP: 332, atk: 659, def: 473, spd: 470, int: 324 },
    skill: ["超魔滅光", "真・ゆうきの斬舞", "神獣の封印", "斬撃よそく"],
    attribute: "",
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1.13, spd: 1.13, atk: 1.05 },
    lstarget: "all",
  },
  {
    name: "超ネルゲル",
    id: "nerugeru",
    type: "tyoma",
    weight: "40",
    status: { HP: 907, MP: 373, atk: 657, def: 564, spd: 577, int: 366 },
    skill: ["ソウルハーベスト", "黄泉の封印", "暗黒閃", "終の流星"],
    attribute: "",
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
  },
  {
    name: "超エルギ",
    id: "erugi",
    type: "tyoma",
    weight: "40",
    status: { HP: 870, MP: 411, atk: 603, def: 601, spd: 549, int: 355 },
    skill: ["失望の光舞", "パニッシュスパーク", "堕天使の理", "終の流星"],
    attribute: "",
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
  },
  {
    name: "イフシバ",
    id: "ifshiba",
    type: "???",
    weight: "25",
    status: { HP: 750, MP: 299, atk: 540, def: 385, spd: 461, int: 415 },
    skill: ["ヘルバーナー", "氷魔のダイヤモンド", "炎獣の爪", "プリズムヴェール"],
    attribute: "",
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
  },
  {
    name: "スカルナイト",
    id: "skull",
    type: "zombie",
    weight: "8",
    status: { HP: 483, MP: 226, atk: 434, def: 304, spd: 387, int: 281 },
    skill: ["ルカナン", "みがわり", "ザオリク", "防刃の守り"],
    attribute: "",
    seed: { atk: 20, def: 5, spd: 95, int: 0 },
    ls: { HP: 1, MP: 1 },
    lstarget: "all",
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
    anchorAction: 100,
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
    element: "", //fire ice thun io wind light dark
    order: "", //preemptive anchor
    preemptivegroup: "num", //1封印の霧,邪神召喚 2マイバリ精霊タップ 3におう 4みがわり 5予測構え 6ぼうぎょ 7全体 8random単体
    targetType: "", //single random all
    targetTeam: "enemy",
    numofhit: "",
    ignoreProt: true,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreGuard: true,
    ignoreEvasion: true,
    MP: 76,
    //ignoreDazzle: true, penetrateIronize: true,
    //文字列・数値格納可能 真偽値？？
    folowingSkill: "ryohuzentai",
  },
  {
    name: "通常攻撃",
    howToCalculate: "atk",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
  },
  {
    name: "ぼうぎょ",
    howToCalculate: "none",
    element: "none",
    targetType: "me",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 6,
  },
  {
    name: "涼風一陣",
    howToCalculate: "fix",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
  },
  {
    name: "神楽の術",
    howToCalculate: "int",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
  },
  {
    name: "昇天斬り",
    howToCalculate: "atk",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
  },
  {
    name: "タップダンス",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 2,
  },
  {
    name: "氷華大繚乱",
    howToCalculate: "atk",
    element: "ice",
    targetType: "random",
    targetTeam: "enemy",
  },
  {
    name: "フローズンシャワー",
    howToCalculate: "fix",
    element: "ice",
    targetType: "single",
    targetTeam: "enemy",
    order: "anchor",
  },
  {
    name: "おぞましいおたけび",
    howToCalculate: "atk",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
  },
  {
    name: "スパークふんしゃ",
    howToCalculate: "fix",
    element: "thun",
    targetType: "random",
    targetTeam: "enemy",
  },
  {
    name: "天空竜の息吹",
    howToCalculate: "fix",
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
  },
  {
    name: "エンドブレス",
    howToCalculate: "fix",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
  },
  {
    name: "テンペストブレス",
    howToCalculate: "fix",
    element: "wind",
    targetType: "single",
    targetTeam: "enemy",
  },
  {
    name: "煉獄火炎",
    howToCalculate: "fix",
    element: "fire",
    targetType: "all",
    targetTeam: "enemy",
  },
  {
    name: "むらくもの息吹",
    howToCalculate: "fix",
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
  },
  {
    name: "獄炎の息吹",
    howToCalculate: "fix",
    element: "fire",
    targetType: "random",
    targetTeam: "enemy",
  },
  {
    name: "ほとばしる暗闇",
    howToCalculate: "fix",
    element: "dark",
    targetType: "all",
    targetTeam: "enemy",
  },
  {
    name: "防刃の守り",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 2,
  },
  {
    name: "ラヴァフレア",
    howToCalculate: "fix",
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    order: "anchor",
  },
  {
    name: "におうだち",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 3,
  },
  {
    name: "大樹の守り",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 2,
  },
  {
    name: "みがわり",
    howToCalculate: "fix",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    excludetargetType: "me",
    order: "preemptive",
    preemptivegroup: 4,
  },
  {
    name: "超魔滅光",
    howToCalculate: "fix",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
  },
  {
    name: "真・ゆうきの斬舞",
    howToCalculate: "atk",
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
    order: "preemptive",
    preemptivegroup: 8,
  },
  {
    name: "神獣の封印",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
  },
  {
    name: "斬撃よそく",
    howToCalculate: "none",
    element: "none",
    targetType: "me",
    targetTeam: "ally",
  },
  {
    name: "ソウルハーベスト",
    howToCalculate: "atk",
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
  },
  {
    name: "黄泉の封印",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
  },
  {
    name: "暗黒閃",
    howToCalculate: "atk",
    element: "dark",
    targetType: "single",
    targetTeam: "enemy",
    order: "preemptive",
    preemptivegroup: 8,
  },
  {
    name: "終の流星",
    howToCalculate: "fix",
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    order: "anchor",
  },
  {
    name: "失望の光舞",
    howToCalculate: "fix",
    element: "light",
    targetType: "random",
    targetTeam: "enemy",
  },
  {
    name: "パニッシュスパーク",
    howToCalculate: "fix",
    element: "thun",
    targetType: "all",
    targetTeam: "enemy",
  },
  {
    name: "堕天使の理",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 2,
  },
  {
    name: "ヘルバーナー",
    howToCalculate: "fix",
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
  },
  {
    name: "氷魔のダイヤモンド",
    howToCalculate: "fix",
    element: "ice",
    targetType: "single",
    targetTeam: "enemy",
  },
  {
    name: "炎獣の爪",
    howToCalculate: "atk",
    element: "fire",
    targetType: "single",
    targetTeam: "enemy",
    order: "preemptive",
    preemptivegroup: 8,
  },
  {
    name: "プリズムヴェール",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
  },
  {
    name: "ルカナン",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
  },
  {
    name: "ザオリク",
    howToCalculate: "none",
    element: "none",
    targetType: "dead",
    targetTeam: "ally",
  },
  {
    name: "タイムストーム",
    howToCalculate: "int",
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
  },
  {
    name: "零時の儀式",
    howToCalculate: "int",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    order: "preemptive",
    preemptivegroup: 7,
  },
  {
    name: "クロノストーム",
    howToCalculate: "int",
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
    order: "preemptive",
    preemptivegroup: 8,
  },
  {
    name: "かくせいリバース",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    order: "anchor",
  },
  {
    name: "呪いの儀式",
    howToCalculate: "int",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
  },
  {
    name: "はめつの流星",
    howToCalculate: "int",
    element: "io",
    targetType: "random",
    targetTeam: "enemy",
  },
  {
    name: "暗黒神の連撃",
    howToCalculate: "fix",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
    order: "anchor",
  },
  {
    name: "真・闇の結界",
    howToCalculate: "none",
    element: "none",
    targetType: "me",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 5,
  },
  {
    name: "必殺の双撃",
    howToCalculate: "atk",
    element: "none",
    targetType: "single",
    targetTeam: "enemy",
  },
  {
    name: "帝王のかまえ",
    howToCalculate: "none",
    element: "none",
    targetType: "me",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 5,
  },
  {
    name: "体砕きの斬舞",
    howToCalculate: "atk",
    element: "none",
    targetType: "random",
    targetTeam: "enemy",
  },
  {
    name: "アストロンゼロ",
    howToCalculate: "none",
    element: "none",
    targetType: "me",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 5,
  },
  {
    name: "衝撃波",
    howToCalculate: "atk",
    element: "none",
    targetType: "all",
    targetTeam: "enemy",
    order: "anchor",
  },
  {
    name: "おおいかくす",
    howToCalculate: "none",
    element: "none",
    targetType: "single",
    targetTeam: "ally",
    order: "preemptive",
    preemptivegroup: 3,
  },
  {
    name: "闇の紋章",
    howToCalculate: "none",
    element: "none",
    targetType: "all",
    targetTeam: "ally",
    following: "", //敵にも付与
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

function karitobattlepage() {
  document.getElementById("adjustpartypage").style.display = "none";
  document.getElementById("battlepage").style.display = "block";
  preparebattle();
  //temporary 戦闘画面移行用
}

document.getElementById("preActionbtn").addEventListener("click", function () {
  const preActiondetector = document.getElementById("preActionbtn").textContent;
  if (preActiondetector === "味方全員行動早い付与") {
    document.getElementById("preActionbtn").textContent = "4体目のみ付与";
    //全員に付与;
    /*
    for (const party of parties) {
      // 各party内のmonsterに対して処理を行う
      for (const monster of party) {
        // preemptiveActionプロパティを追加
        monster.preemptiveAction = 100;
      }
    }*/
    parties[0][0].preemptiveAction = 100;
    parties[0][1].preemptiveAction = 100;
    parties[0][2].preemptiveAction = 100;
    parties[0][3].preemptiveAction = 100;
    parties[0][4].preemptiveAction = 100;
  } else {
    document.getElementById("preActionbtn").textContent = "味方全員行動早い付与";
    for (const party of parties) {
      for (const monster of party) {
        delete monster.preemptiveAction;
      }
    }
    if (parties[0] && parties[0][3]) {
      parties[0][3].preemptiveAction = 100;
    }
  }
  decideTurnOrder(parties, skill);
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

// 死亡判定を行う関数
function isDead(monster) {
  return monster.flags.isDead === true;
}

// 状態異常判定を行う関数
function hasAbnormality(monster) {
  const abnormalityKeys = ["fear", "confused", "paralyzed", "asleep", "stoned", "sealed"];
  for (const key of abnormalityKeys) {
    if (monster.abnormalities[key]) {
      return true;
    }
  }
  return false;
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

      const effectImagePath = MP ? "images/systems/MPRecovery.png" : "images/systems/HPRecovery.png"; // MP回復かHP回復か

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
      digitImage.style.maxWidth = "50%";
      digitImage.style.height = "auto";
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
    const damageContainer = document.createElement("div");
    damageContainer.style.position = "absolute";
    damageContainer.style.display = "flex";
    damageContainer.style.top = "50%";
    damageContainer.style.left = "50%";
    damageContainer.style.transform = "translate(-50%, -50%)";
    damageContainer.style.justifyContent = "center";

    // ダメージ/回復効果画像を設定
    let effectImagePath = "";
    if (resistance === -1) {
      // 回復の場合
      effectImagePath = MP ? "images/systems/MPRecovery.png" : "images/systems/HPRecovery.png";
    } else {
      // ダメージの場合
      effectImagePath = MP ? "images/systems/MPDamaged.png" : monster.teamID === 0 ? "images/systems/allyDamaged.png" : "images/systems/enemyDamaged.png";

      // 耐性によって画像を変更 (HPダメージの場合のみ)
      if (!MP) {
        if (resistance === "Weakness") {
          effectImagePath = monster.teamID === 0 ? "images/systems/allyDamagedWeakness.png" : "images/systems/enemyDamagedWeakness.png";
        } else if (resistance === "superWeakness") {
          effectImagePath = monster.teamID === 0 ? "images/systems/allyDamagedSuperWeakness.png" : "images/systems/enemyDamagedSuperWeakness.png";
        } else if (resistance === "ultraWeakness") {
          effectImagePath = monster.teamID === 0 ? "images/systems/allyDamagedUltraWeakness.png" : "images/systems/enemyDamagedUltraWeakness.png";
        }
      }
    }

    const effectImage = document.createElement("img");
    effectImage.src = effectImagePath;
    effectImage.style.position = "absolute";
    effectImage.style.width = monsterIcon.offsetWidth + "px";
    effectImage.style.height = monsterIcon.offsetHeight + "px";
    effectImage.style.top = monsterIcon.offsetTop + "px";
    effectImage.style.left = monsterIcon.offsetLeft + "px";

    monsterIcon.parentElement.appendChild(effectImage);
    monsterIcon.parentElement.appendChild(damageContainer);

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
      digitImage.style.maxWidth = "50%";
      digitImage.style.height = "auto";
      digitImage.style.marginLeft = "-2px";
      digitImage.style.marginRight = "-2px";
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
      effectImage.remove();
      damageContainer.remove();
    }, digits.length * 30 + 90 + 140);
  }
}

document.getElementById("testbtn").addEventListener("click", function () {
  displayDamage(parties[0][0], 1003, "normal");
  displayDamage(parties[0][1], 2334, "normal");
  displayDamage(parties[0][2], 234, "normal");
  displayDamage(parties[0][3], 33, "normal");
  displayDamage(parties[0][4], 3, "normal");
});

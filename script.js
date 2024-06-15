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

document.getElementById("karibtn").addEventListener("click", function () {
  document.getElementById("adjustpartypage").style.display = "block";
  document.getElementById("battlepage").style.display = "none";
});
document.getElementById("testbtn").addEventListener("click", function () {
  console.log(parties);
});

function preparebattle() {
  //partiesの中身に、displaystatusからlsを反映してdefaultstatusを生成
  parties.forEach((party) => {
    // パーティーのリーダースキルを取得
    const leaderSkill = party[0].ls;
    const lstarget = party[0].lstarget;

    // 各モンスターについて処理を行う
    party.forEach((monster) => {
      const defaultstatus = {};
      // デフォルトのステータス倍率1倍でdefaultstatusを生成
      Object.keys(monster.displaystatus).forEach((key) => {
        defaultstatus[key] = monster.displaystatus[key];
      });

      // lstargetがallの場合または各モンスターのtypeと一致する場合に処理を行う
      if (lstarget === "all" || monster.type === lstarget) {
        // lsで指定されたステータス倍率がある場合はそれに置き換える
        Object.keys(defaultstatus).forEach((key) => {
          if (leaderSkill[key]) {
            defaultstatus[key] = Math.ceil(defaultstatus[key] * leaderSkill[key]);
          }
        });
      }
      // defaultstatusをモンスターオブジェクトに追加
      monster.defaultstatus = defaultstatus;
    });
  });
  //ls反映済defaultstatus生成終了
  //defaultstatusのHPやMPがHPmax、MPmaxを意味する

  //バフ込みのcurrentstatus生成
  function createcurrentstatus() {
    parties.forEach((party) => {
      // 各モンスターについて処理を行う
      party.forEach((monster) => {
        const currentstatus = {};
        // デフォルトのステータス倍率1倍でdefaultstatusを生成
        Object.keys(monster.defaultstatus).forEach((key) => {
          currentstatus[key] = monster.defaultstatus[key];
        });

        // defaultstatusをモンスターオブジェクトに追加
        monster.currentstatus = currentstatus;
      });
    });
  }
  createcurrentstatus();
  //このcurrentのHPMPを動かしていく
  //todo:バフ保管場所も生成したい

  updateHPMPdisplay();
  //初期処理不要、updateのみで対応

  //戦闘画面の10のimgのsrcを設定
  //partyの中身のidとgearidから、適切な画像を設定
  preparebattlepageicons(1, 0);

  //confirmedcommand格納場所生成
  parties.forEach((party) => {
    // 各モンスターについて処理を行う
    party.forEach((monster) => {
      monster.confirmedcommand = "";
      monster.confirmedcommandtarget = "";
    });
  });
  //todo:初期処理の統合

  //コマンド選択段階判定変数の初期化と、最初のモンスターをstickout、他からclass削除
  backbtn();
}
//finish preparebattle 開始時処理終了

//戦闘開始時の10のアイコン更新と、targetteamごとに特技target選択画面で起動
function updatebattleicons(elementId, id) {
  const iconSrc = "images/icons/" + id + ".jpeg";
  document.getElementById(elementId).src = iconSrc;
}

//prepare、コマンド選択時に起動
function preparebattlepageicons(top, bottom) {
  //(1,0)が通常、(0,1)が逆
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

//////////////////////////////////////////////////////////////特技選択フロー

let selectingwhichmonsterscommand = 0;
let selectingwhichteamscommand = 0;
function startselectingcommand() {
  document.getElementById("designateskilltarget").style.visibility = "hidden";
  document.getElementById("designateskilltarget-all").style.visibility = "hidden";
  document.getElementById("askfinishselectingcommand").style.visibility = "hidden";
  document.getElementById("howtoselectenemyscommand").style.visibility = "hidden";
  //party内該当monsterのskillのn番目要素をそのまま表示
  document.getElementById("selectskillbtn0").textContent = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[0];
  document.getElementById("selectskillbtn1").textContent = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[1];
  document.getElementById("selectskillbtn2").textContent = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[2];
  document.getElementById("selectskillbtn3").textContent = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[3];
  document.getElementById("selectcommandpopupwindow").style.visibility = "visible";
  disablecommandbtns(true);
  document.getElementById("selectskillbtns").style.visibility = "visible";
  document.getElementById("selectcommandpopupwindow-text").textContent = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].name;
  document.getElementById("selectcommandpopupwindow-text").style.visibility = "visible";
  //monster名表示に戻す
  //todo:inline?block?
}

function selectcommand(selectedskillnum) {
  const selectedskillname = parties[selectingwhichteamscommand][selectingwhichmonsterscommand].skill[selectedskillnum];
  parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommand = selectedskillname;
  //nameを取得してconfirmedcommandに保存
  document.getElementById("selectskillbtns").style.visibility = "hidden";
  const skilltargetdetector = skill.find((item) => item.name === selectedskillname).target;
  const skilltargetteamdetector = skill.find((item) => item.name === selectedskillname).targetteam;
  //nameからskill配列を検索、targetとtargetteamを引いてくる
  if (skilltargetdetector === "random" || skilltargetdetector === "single") {
    //randomもしくはsingleのときはtextをmonster名から指示に変更して表示
    document.getElementById("selectcommandpopupwindow-text").textContent = "たたかう敵モンスターをタッチしてください。";
    document.getElementById("selectcommandpopupwindow-text").style.visibility = "visible";
    //targetがrandomもしくはsingleのとき、target選択画面を表示
    //味方選択中かつtargetteamがenemyのとき、または敵選択中かつtargetteamがallyのとき、敵画像を代入
    //逆に味方選択中かつtargetteamがallyのとき、または敵選択中かつtargetteamがenemyのとき、味方画像を代入
    if ((selectingwhichteamscommand === 0 && skilltargetteamdetector === "enemy") || (selectingwhichteamscommand === 1 && skilltargetteamdetector === "ally")) {
      const targetteamnum = 1;
      //敵画像
      selectskilltargettoggler(targetteamnum);
    } else {
      const targetteamnum = 0;
      selectskilltargettoggler(targetteamnum);
    }
    function selectskilltargettoggler(targetteamnum) {
      updatebattleicons("selecttargetmonster0", parties[targetteamnum][0].id);
      updatebattleicons("selecttargetmonster1", parties[targetteamnum][1].id);
      updatebattleicons("selecttargetmonster2", parties[targetteamnum][2].id);
      updatebattleicons("selecttargetmonster3", parties[targetteamnum][3].id);
      updatebattleicons("selecttargetmonster4", parties[targetteamnum][4].id);
    }
    document.getElementById("designateskilltarget").style.visibility = "visible";
  } else {
    //targetがrandomでもsingleでもないとき、all(yesno)画面を起動
    document.getElementById("designateskilltarget-all-text").textContent = selectedskillname + "を使用しますか？";
    document.getElementById("designateskilltarget-all").style.visibility = "visible";
    document.getElementById("selectcommandpopupwindow-text").style.visibility = "hidden";
    //allならmonster名は隠すのみ
    parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommandtarget = "all";
    //ランダムまたは単体はtarget選択画面を起動
    //処理上まずはskillのtarget属性で分類、その後randomやsingleの場合はここで保存された相手に撃つ処理
  }
}

//all-yesbtnの処理
document.getElementById("designateskilltargetbtnyes").addEventListener("click", function () {
  document.getElementById("designateskilltarget-all").style.visibility = "hidden";
  //5体目選択後分岐
  if (selectingwhichmonsterscommand > 3) {
    askfinishselectingcommand();
    return;
  }
  document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
  disablecommandbtns(false);
  //yesno画面とpopup全体を閉じる
  selectingwhichmonsterscommand += 1;
  adjustmonstericonstickout();
  //選択終了、次のコマンド選択を待機
});
//all-nobtn処理
document.getElementById("designateskilltargetbtnno").addEventListener("click", function () {
  document.getElementById("designateskilltarget-all").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
  disablecommandbtns(false);
  //yesno画面とpopup全体を閉じる、選択済のconfirmedcommandとtarget:allは後に上書き
});

//skilltarget選択画面
document.querySelectorAll(".selecttargetmonster").forEach((img) => {
  img.addEventListener("click", () => {
    const imgId = img.getAttribute("id");
    parties[selectingwhichteamscommand][selectingwhichmonsterscommand].confirmedcommandtarget = imgId.replace("selecttargetmonster", "");
    document.getElementById("designateskilltarget").style.visibility = "hidden";
    document.getElementById("selectcommandpopupwindow-text").style.visibility = "hidden";
    //テキストとtarget選択iconを閉じる
    //5体目選択後分岐
    if (selectingwhichmonsterscommand > 3) {
      askfinishselectingcommand();
      return;
    }
    document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
    //popup全体を閉じる
    disablecommandbtns(false);
    selectingwhichmonsterscommand += 1;
    adjustmonstericonstickout();
    //選択終了、次のコマンド選択を待機
  });
});

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
  selectingwhichmonsterscommand = Math.max(selectingwhichmonsterscommand - 1, 0);
  adjustmonstericonstickout();
}

//閉じるbtn
document.getElementById("closeselectcommandpopupwindowbtn").addEventListener("click", function () {
  document.getElementById("designateskilltarget").style.visibility = "hidden";
  document.getElementById("designateskilltarget-all").style.visibility = "hidden";
  document.getElementById("selectskillbtns").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow-text").style.visibility = "hidden";
  document.getElementById("askfinishselectingcommand").style.visibility = "hidden";
  document.getElementById("howtoselectenemyscommand").style.visibility = "hidden";
  disablecommandbtns(false);
  //全閉じ
});

function disablecommandbtns(trueorfalse) {
  document.querySelectorAll(".commandbtn").forEach((button) => {
    button.disabled = trueorfalse;
  });
}

//コマンド選択を終了しますか
function askfinishselectingcommand() {
  document.getElementById("askfinishselectingcommand").style.visibility = "visible";
}

//コマンド選択終了画面でno選択時、yesno選択画面とpopup全体を閉じて5体目コマンド選択前に戻す
document.getElementById("askfinishselectingcommandbtnno").addEventListener("click", function () {
  document.getElementById("askfinishselectingcommand").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
  disablecommandbtns(false);
  //閉じる処理と同様の処理
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
  selectingwhichmonsterscommand = 0;
  selectingwhichteamscommand = 1;
  document.getElementById("howtoselectenemyscommand").style.visibility = "hidden";
  document.getElementById("selectcommandpopupwindow").style.visibility = "hidden";
  //以下、手動選択のための処理
  disablecommandbtns(false);
  //アイコン反転
  preparebattlepageicons(0, 1);
  adjustmonstericonstickout();
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

function startbattle() {
  console.log(parties);
}

//todo:死亡時や蘇生時、攻撃ダメージmotionのアイコン調整も
/*
バフ管理システムと、currentstatusを作成
最初の展開と処理
ステータスとバフの管理
コマンド入力
先制アンカーと、行動順処理
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
    name: "宵の華シンリ",
    id: "sinri",
    type: "ドラゴン",
    status: { HP: 100, MP: 100, atk: 100, def: 100, spd: 100, int: 100 },
    skill: ["涼風一陣", "神楽の術", "昇天斬り", "タップダンス"],
    attribute: "",
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 1.3, spd: 1.3 },
    lstarget: "ドラゴン",
  },
  {
    name: "魔夏姫アンルシア",
    id: "rusia",
    type: "悪魔",
    status: { HP: 1000, MP: 1000, atk: 1000, def: 1000, spd: 1000, int: 1000 },
    skill: ["氷華大繚乱", "フローズンシャワー", "おぞましいおたけび", "スパークふんしゃ"],
    attribute: "",
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 0.1, spd: 0.1 },
    lstarget: "スライム",
  },
  {
    name: "怪竜やまたのおろち",
    id: "orochi",
    type: "ドラゴン",
    status: { HP: 500, MP: 500, atk: 500, def: 500, spd: 500, int: 500 },
    skill: ["むらくもの息吹", "獄炎の息吹", "ほとばしる暗闇", "防刃の守り"],
    attribute: "",
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 100, spd: 100 },
    lstarget: "スライム",
  },
  {
    name: "マスタードラゴン",
    id: "masudora",
    type: "ドラゴン",
    status: { HP: 700, MP: 700, atk: 700, def: 700, spd: 700, int: 700 },
    skill: ["天空竜の息吹", "エンドブレス", "テンペストブレス", "煉獄火炎"],
    attribute: "",
    seed: { atk: 0, def: 0, spd: 0, int: 0 },
    ls: { HP: 10, spd: 10 },
    lstarget: "ドラゴン",
  },
  {
    name: "ヴォルカドラゴン",
    id: "voruka",
    type: "スライム",
    status: { HP: 1300, MP: 1300, atk: 1300, def: 1300, spd: 1300, int: 1300 },
    skill: ["ラヴァフレア", "におうだち", "大樹の守り", "みがわり"],
    attribute: "",
    seed: { atk: 0, def: 0, spd: 0, int: 0 },
    ls: { HP: 10, MP: 10 },
    lstarget: "all",
  },
];
//ウェイトなども。あと、特技や特性は共通項もあるので別指定も可能。

const skill = [
  {
    name: "なし",
    howToCalculate: "",
    attribute: "",
  },
  {
    name: "",
    id: "number?",
    type: "", //spell slash martial breath ritual
    howToCalculate: "", //atk int fix def spd
    attribute: "", //fire ice thun expl wind light dark
    order: "", //preemptive anchor
    target: "", //single random all
    targetteam: "enemy",
    numofhit: "",
    ignoreProt: true,
    ignoreReflection: true,
    ignoreSubstitute: true,
    ignoreGuard: true,
    ignoreEvasion: true,
    MP: 76,
    //ignoreDazzle: true, penetrateIronize: true,
    //文字列・数値格納可能 真偽値？？
    folowingskill: "ryohuzentai",
  },
  {
    name: "涼風一陣",
    howToCalculate: "fix",
    attribute: "none",
    target: "all",
    targetteam: "enemy",
  },
  {
    name: "神楽の術",
    howToCalculate: "int",
    attribute: "none",
    target: "all",
    targetteam: "enemy",
  },
  {
    name: "昇天斬り",
    howToCalculate: "atk",
    attribute: "none",
    target: "single",
    targetteam: "enemy",
  },
  {
    name: "タップダンス",
    howToCalculate: "none",
    attribute: "none",
    target: "all",
    targetteam: "ally",
  },
  {
    name: "氷華大繚乱",
    howToCalculate: "atk",
    attribute: "ice",
    target: "random",
    targetteam: "enemy",
  },
  {
    name: "フローズンシャワー",
    howToCalculate: "fix",
    attribute: "ice",
    target: "single",
    targetteam: "enemy",
  },
  {
    name: "おぞましいおたけび",
    howToCalculate: "atk",
    attribute: "none",
    target: "all",
    targetteam: "enemy",
  },
  {
    name: "スパークふんしゃ",
    howToCalculate: "fix",
    attribute: "thun",
    target: "random",
    targetteam: "enemy",
  },
  {
    name: "天空竜の息吹",
    howToCalculate: "fix",
    attribute: "light",
    target: "random",
    targetteam: "enemy",
  },
  {
    name: "エンドブレス",
    howToCalculate: "fix",
    attribute: "none",
    target: "all",
    targetteam: "enemy",
  },
  {
    name: "テンペストブレス",
    howToCalculate: "fix",
    attribute: "wind",
    target: "single",
    targetteam: "enemy",
  },
  {
    name: "煉獄火炎",
    howToCalculate: "fix",
    attribute: "fire",
    target: "all",
    targetteam: "enemy",
  },
  {
    name: "むらくもの息吹",
    howToCalculate: "fix",
    attribute: "none",
    target: "random",
    targetteam: "enemy",
  },
  {
    name: "獄炎の息吹",
    howToCalculate: "fix",
    attribute: "fire",
    target: "random",
    targetteam: "enemy",
  },
  {
    name: "ほとばしる暗闇",
    howToCalculate: "fix",
    attribute: "dark",
    target: "all",
    targetteam: "enemy",
  },
  {
    name: "防刃の守り",
    howToCalculate: "none",
    attribute: "none",
    target: "all",
    targetteam: "ally",
  },
  {
    name: "ラヴァフレア",
    howToCalculate: "fix",
    attribute: "fire",
    target: "single",
    targetteam: "enemy",
  },
  {
    name: "におうだち",
    howToCalculate: "none",
    attribute: "none",
    target: "all",
    targetteam: "ally",
  },
  {
    name: "大樹の守り",
    howToCalculate: "none",
    attribute: "none",
    target: "all",
    targetteam: "ally",
  },
  {
    name: "みがわり",
    howToCalculate: "fix",
    attribute: "none",
    target: "single",
    targetteam: "ally",
  },
  {
    name: "邪道のかくせい",
    howToCalculate: "none",
    attribute: "none",
  },
  {
    name: "絶氷の嵐",
    howToCalculate: "int",
    attribute: "ice",
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

//初期処理
document.getElementById("battlepage").style.display = "none";
const defaultMonster = {
  name: "未選択",
  id: "unselected",
  type: "",
  status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 0 },
  skill: ["unselected", "unselected", "unselected", "unselected"],
  attribute: "",
  seed: { atk: 0, def: 0, spd: 0, int: 0 },
  gear: {
    name: "",
    id: "ungeared",
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 0 },
    effect: "no",
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
/*let allparties = [
  { party: [...defaultparty] },
  { party: [...defaultparty] },
  { party: [...defaultparty] },
  { party: [...defaultparty] },
  { party: [...defaultparty] },
  { party: [...defaultparty] },
  { party: [...defaultparty] },
  { party: [...defaultparty] },
  { party: [...defaultparty] },
  { party: [...defaultparty] }
];
*/
let allparties = Array.from({ length: 10 }, () => ({ party: [...defaultparty] }));
let parties = [{ party: [...defaultparty] }, { party: [...defaultparty] }];

// allparties[0].party が party1

let party = [...defaultparty];
let selectingpartynum = 1;
//party初期化

function selectparty() {
  // 現在のpartyをselectingpartyに格納
  allparties[selectingpartynum - 1].party = structuredClone(party);
  console.log(allparties);

  //シャローコピー
  //やり方自体改善必要、chatに投げよう
  //それまで選択中のpartyに格納
  // selectingpartyを選択値に更新
  selectingpartynum = parseInt(document.getElementById("selectparty").value);
  party = structuredClone(allparties[selectingpartynum - 1].party);
  //console.log(newparty, window[newparty], aaa, window, party2);
  //party.splice(0, party.length, ...window[newparty]);
  // partyの要素を新しいpartyの要素で置き換える

  //仮party配列を操作し、選択中partyをいじった際に仮配列で上書き、新partyを上から下ろす

  //頭モンスターを選択状態に
  switchTab(1);
  /*

document.getElementById('status-info-displayHP').textContent = "0";
document.getElementById('status-info-displayMP').textContent = "0";
document.getElementById('status-info-displayatk').textContent = "0";
document.getElementById('status-info-displaydef').textContent = "0";
document.getElementById('status-info-displayspd').textContent = "0";
document.getElementById('status-info-displayint').textContent = "0";

document.getElementById('status-info-seedgear-HP').textContent = "(+0)";
document.getElementById('status-info-seedgear-MP').textContent = "(+0)";
document.getElementById('status-info-seedgear-atk').textContent = "(+0)";
document.getElementById('status-info-seedgear-def').textContent = "(+0)";
document.getElementById('status-info-seedgear-spd').textContent = "(+0)";
document.getElementById('status-info-seedgear-int').textContent = "(+0)";

document.getElementById('selectseed-atk').value = 0;
document.getElementById('selectseed-def').value = 0;
document.getElementById('selectseed-spd').value = 0;
document.getElementById('selectseed-int').value = 0;
document.getElementById('skill1').textContent = "";
document.getElementById('skill2').textContent = "";
document.getElementById('skill3').textContent = "";
document.getElementById('skill4').textContent = "";
*/

  //icon10個

  function updateImage(elementId, id, gearId) {
    var iconSrc = id ? "images/icons/" + id + ".jpeg" : "images/icons/unselected.jpeg";
    var gearSrc = gearId ? "images/gear/" + gearId + ".jpeg" : "images/gear/ungeared.jpeg";

    document.getElementById(elementId).src = iconSrc;
    document.getElementById("allygear" + elementId.slice(-1)).src = gearSrc;
  }

  updateImage("allyicon1", party[0]?.id, party[0]?.gear?.id);
  updateImage("allyicon2", party[1]?.id, party[1]?.gear?.id);
  updateImage("allyicon3", party[2]?.id, party[2]?.gear?.id);
  updateImage("allyicon4", party[3]?.id, party[3]?.gear?.id);
  updateImage("allyicon5", party[4]?.id, party[4]?.gear?.id);
}

let allyorenemy = "ally";
// オプションを置き換える関数
function replacepartyOptions() {
  selectElement.innerHTML = ""; // 現在のオプションをクリア

  // 新しいオプションを追加
  for (let i = 6; i <= 10; i++) {
    selectElement.innerHTML += `<option value="${i}">パーティ${i - 5}</option>`;
  }
}
// 元のオプションに戻す関数
function restorepartyOptions() {
  const selectElement = document.getElementById("selectparty");
  selectElement.innerHTML = selectElement.firstElementChild.outerHTML;
}

function confirmparty() {
  const selectpartymanipu = document.getElementById("selectparty");

  //もしpartyの中にunselectedやungearedが入っていたらalert

  if (allyorenemy === "ally") {
    //状態の保存とselect入れ替え
    allyorenemy = "enemy";
    document.getElementById("playerAorB").textContent = "プレイヤーB";
    //新しいoptionを追加
    for (let i = 6; i <= 10; i++) {
      selectpartymanipu.innerHTML += `<option value="${i}">パーティ${i - 5}</option>`;
    }
    document.getElementById("selectparty").value = 6;
    //現在の仮をpartiesへのコピー確定、selectpartyを6にして敵を表示状態にした上で、selectparty関数で仮の代入とenemy編成をhtmlに展開
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
    //6-10を削除
    selectpartymanipu.querySelectorAll('option[value="6"], option[value="7"], option[value="8"], option[value="9"], option[value="10"]').forEach((option) => option.remove());
    //displayで全体切り替え、startbattleへ
    document.getElementById("adjustpartypage").style.display = "none";
    document.getElementById("battlepage").style.display = "block";
    startbattle();
    console.log(parties);
  }
}

document.getElementById("karibtn").addEventListener("click", function () {
  document.getElementById("adjustpartypage").style.display = "block";
  document.getElementById("battlepage").style.display = "none";
});
document.getElementById("testbtn").addEventListener("click", function () {
  console.log(parties);
});

function startbattle() {
  //partiesの中身に、displaystatusからlsを反映してdefaultstatusを作成
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
  upadatecurrentstatus();
  updateHPMPdisplay();
}
//finish startbattle

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

//currentstatus生成
function upadatecurrentstatus() {
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

//特技選択画面
document.getElementById("selectskillbtns").style.display = "none";
//初期処理、divではなくclassでそれぞれ指定も可
document.getElementById("openselectskillbtn").addEventListener("click", function () {
  document.getElementById("selectskillbtns").style.display = "inline";
  document.getElementById("openselectskillbtn").style.display = "none";
});
function selectskill(whichskill) {
  document.getElementById("selectskillbtns").style.display = "none";
  document.getElementById("openselectskillbtn").style.display = "block";
}

//HPMP表示を更新する
function updateHPMPdisplay() {
  document.getElementById("allymonster0").innerHTML = parties[0][0].currentstatus.HP;
  document.getElementById("allymonster1").innerHTML = parties[0][1].currentstatus.HP;
  document.getElementById("allymonster2").innerHTML = parties[0][2].currentstatus.HP;
  document.getElementById("allymonster3").innerHTML = parties[0][3].currentstatus.HP;
  document.getElementById("allymonster4").innerHTML = parties[0][4].currentstatus.HP;
  document.getElementById("enemymonster0").innerHTML = parties[1][0].currentstatus.HP;
  document.getElementById("enemymonster1").innerHTML = parties[1][1].currentstatus.HP;
  document.getElementById("enemymonster2").innerHTML = parties[1][2].currentstatus.HP;
  document.getElementById("enemymonster3").innerHTML = parties[1][3].currentstatus.HP;
  document.getElementById("enemymonster4").innerHTML = parties[1][4].currentstatus.HP;
}

//monster選択部分
let selectingmonstericon = "";
let selectingmonsternum = "";
let selectingmonsternumminus1 = "";
const allyIcons = document.querySelectorAll('[id^="allyicon"]');
allyIcons.forEach((icon) => {
  icon.addEventListener("click", function () {
    document.body.style.overflow = "hidden";
    document.getElementById("selectmonsteroverlay").style.visibility = "visible";
    document.getElementById("selectmonsterpopupwindow").style.opacity = "1";
    selectingmonstericon = icon.id;
    selectingmonsternum = selectingmonstericon.replace(/(icon|ally)/g, "");
    selectingmonsternum = Number(selectingmonsternum);
    selectingmonsternumminus1 = selectingmonsternum - 1;
    //配列検索用に-1
  });
});
//枠をクリック時、ウィンドウを開き、どの枠を選択中か取得、selectingmonstericonにidを格納-allyicon1、selectingmonsternumに1-5を格納、minus1に配列用で1引いてっか右脳

document.getElementById("selectmonsteroverlay").addEventListener("click", function () {
  //ここselectmonsterbg_grayではなくselectmonsteroverlayにすると、ウィンドウ白部分をタップでウィンドウ閉じるように
  document.getElementById("selectmonsteroverlay").style.visibility = "hidden";
  document.getElementById("selectmonsterpopupwindow").style.opacity = "0";
  document.body.style.overflow = "";
});
//まわりクリックで閉じる

function selectMonster(monsterName) {
  //ポップアップ内各画像クリック時に起動
  const newmonsterImageSrc = "images/icons/" + monsterName + ".jpeg";
  document.getElementById(selectingmonstericon).src = newmonsterImageSrc;
  //取得した選択中の枠に、ポップアップウィンドウ内で選択したモンスターの画像を代入

  const targetgear = "allygear" + selectingmonsternum;
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

const allyGear = document.querySelectorAll('[id^="allygear"]');
allyGear.forEach((icon) => {
  icon.addEventListener("click", function () {
    document.body.style.overflow = "hidden";
    document.getElementById("selectgearoverlay").style.visibility = "visible";
    document.getElementById("selectgearpopupwindow").style.opacity = "1";
    selectinggear = icon.id;
    selectinggearnum = selectinggear.replace(/(gear|ally)/g, "");
    selectinggearnum = Number(selectinggearnum);
    selectinggearnumminus1 = selectinggearnum - 1;
    //配列検索用に-1
  });
});
//装備枠クリック時、ウィンドウを開き、どの装備枠を選択中か取得、selectinggearにidを格納-allygear1、selectinggearnumに1-5を格納

document.getElementById("selectgearoverlay").addEventListener("click", function () {
  //ここselectgearbg_grayではなくselectgearoverlayにすると、ウィンドウ白部分をタップでウィンドウ閉じる
  document.getElementById("selectgearoverlay").style.visibility = "hidden";
  document.getElementById("selectgearpopupwindow").style.opacity = "0";
  document.body.style.overflow = "";
});
//まわりクリックで閉じる

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
  //console.log(party);
  document.getElementById("skill1").textContent = skill.find((item) => item.id === party[tabm1].skill[0]).name;
  document.getElementById("skill2").textContent = skill.find((item) => item.id === party[tabm1].skill[1]).name;
  document.getElementById("skill3").textContent = skill.find((item) => item.id === party[tabm1].skill[2]).name;
  document.getElementById("skill4").textContent = skill.find((item) => item.id === party[tabm1].skill[3]).name;
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
    name: "シンリ",
    id: "sinri",
    type: "ドラゴン",
    status: { HP: 100, MP: 100, atk: 100, def: 100, spd: 100, int: 100 },
    skill: ["ryohu", "kagura", "jado", "zetsuhyo"],
    attribute: "",
    seed: { atk: 0, def: 25, spd: 95, int: 0 },
    ls: { HP: 200, spd: 200 },
    lstarget: "ドラゴン",
  },
  {
    name: "ルシア",
    id: "rusia",
    type: "悪魔",
    status: { HP: 1000, MP: 1000, atk: 1000, def: 1000, spd: 1000, int: 1000 },
    skill: ["ryoran", "shawer", "supahun", "ozo"],
    attribute: "",
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 0.1, spd: 0.1 },
    lstarget: "スライム",
  },
  {
    name: "おろち",
    id: "orochi",
    type: "ドラゴン",
    status: { HP: 500, MP: 500, atk: 500, def: 500, spd: 500, int: 500 },
    skill: ["supahun", "ozo", "ozo", "ozo"],
    attribute: "",
    seed: { atk: 25, def: 0, spd: 95, int: 0 },
    ls: { HP: 100, spd: 100 },
    lstarget: "スライム",
  },
  {
    name: "あ",
    id: "aaa",
    type: "ドラゴン",
    status: { HP: 1, MP: 1, atk: 1, def: 1, spd: 1, int: 1 },
    skill: ["supahun", "ozo", "ozo", "ozo"],
    attribute: "",
    seed: { atk: 0, def: 0, spd: 0, int: 0 },
    ls: { HP: 10, spd: 10 },
    lstarget: "all",
  },
  {
    name: "い",
    id: "iii",
    type: "スライム",
    status: { HP: 2, MP: 2, atk: 2, def: 2, spd: 2, int: 2 },
    skill: ["supahun", "ozo", "ozo", "ozo"],
    attribute: "",
    seed: { atk: 0, def: 0, spd: 0, int: 0 },
    ls: { HP: 10, spd: 10 },
    lstarget: "all",
  },
];
//ウェイトなども。あと、特技や特性は共通項もあるので別指定も可能。
/*
const parties = [
    [
        {
            name: "シンリ",
            id: "sinri",
            type: "ドラゴン",
            status: { HP: 100, MP: 100, atk: 100, def: 100, spd: 100, int: 100 },
            skill: [ "ryohu", "kagura", "jado", "zetsuhyo" ],
            attribute: "",
            seed: { atk: 0, def: 25, spd: 95, int: 0 },
            ls: { HP:1.3, spd: 1.5}
            lstarget: "ドラゴン"
        },
        {
            name: "ルシア",
            id: "rusia",
            type: "悪魔",
            status: { HP: 1000, MP: 1000, atk: 1000, def: 1000, spd: 1000, int: 1000 },
            skill: [ "ryoran", "shawer", "supahun", "ozo" ],
            attribute: "",
            seed: { atk: 25, def: 0, spd: 95, int: 0 }
            ls: { HP:1.3, spd: 1.5}
            lstarget: "スライム"
        },
        {
            name: "おろち",
            id: "orochi",
            type: "ドラゴン",
            status: { HP: 500, MP: 500, atk: 500, def: 500, spd: 500, int: 500 },
            skill: [ "supahun", "ozo", "ozo", "ozo" ],
            attribute: "",
            seed: { atk: 25, def: 0, spd: 95, int: 0 }
            ls: { HP:1.3, spd: 1.5}
            lstarget: "ドラゴン"
        }
    ],
    [
    {
            name: "スライム",
            id: "slime",
            type: "スライム",
            status: { HP: 500, MP: 500, atk: 500, def: 500, spd: 500, int: 500 },
            skill: [ "supahun", "ozo", "ozo", "ozo" ],
            attribute: "",
            seed: { atk: 25, def: 0, spd: 95, int: 0 }
            ls: { HP:1.3, spd: 1.5}
            lstarget: "ドラゴン"
        },
        {
            name: "ドラキー",
            id: "doraky",
            type: "悪魔",
            status: { HP: 1000, MP: 1000, atk: 1000, def: 1000, spd: 1000, int: 1000 },
            skill: [ "ryoran", "shawer", "supahun", "ozo" ],
            attribute: "",
            seed: { atk: 25, def: 0, spd: 95, int: 0 }
            ls: { HP:1.3, spd: 1.5}
            lstarget: "ドラゴン"
        }
    ]
];
*/

const skill = [
  {
    name: "",
    id: "unselected",
    howToCalculate: "",
    attribute: "",
  },
  {
    name: "涼風一陣",
    id: "ryohu",
    howToCalculate: "fix",
    attribute: "no",
  },
  {
    name: "神楽の術",
    id: "kagura",
    howToCalculate: "int",
    attribute: "no",
  },
  {
    name: "邪道のかくせい",
    id: "jado",
    howToCalculate: "no",
    attribute: "no",
  },
  {
    name: "絶氷の嵐",
    id: "zetsuhyo",
    howToCalculate: "int",
    attribute: "ice",
  },
  {
    name: "氷華大繚乱",
    id: "ryoran",
    howToCalculate: "atk",
    attribute: "ice",
  },
  {
    name: "フローズンシャワー",
    id: "shawer",
    howToCalculate: "fix",
    attribute: "ice",
  },
  {
    name: "スパふん",
    id: "supahun",
    howToCalculate: "fix",
    attribute: "gira",
  },
  {
    name: "おぞおた",
    id: "ozo",
    howToCalculate: "atk",
    attribute: "no",
  },

  //mera hyado gira io bagi dein doruma

  {},
];

const gear = [
  {
    name: "",
    id: "ungeared",
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 0, int: 0 },
    effect: "no",
  },
  {
    name: "メタ爪",
    id: "metanail",
    status: { HP: 0, MP: 0, atk: 15, def: 0, spd: 56, int: 0 },
    effect: "no",
  },
  {
    name: "竜神爪",
    id: "ryujinnail",
    status: { HP: 0, MP: 0, atk: 0, def: 0, spd: 42, int: 0 },
    effect: "no",
  },
  {
    name: "砕き",
    id: "kudaki",
    status: { HP: 0, MP: 0, atk: 22, def: 0, spd: 15, int: 0 },
    effect: "no",
  },
  {
    name: "昇天",
    id: "shoten",
    status: { HP: 0, MP: 0, atk: 23, def: 0, spd: 0, int: 28 },
    effect: "no",
  },

  {},
]; //finish gear

function monsterchange() {
  //モンスター変更時にここを駆動 味方と敵でfunを分けて軽量化したりしても可
  //このvalueは日本語名で制御。
  /*
const ally1name = document.getElementById("ally1name").value;

const ally2name = document.getElementById("ally2name").value;
const ally3name = document.getElementById("ally3name").value;
const ally4name = document.getElementById("ally4name").value;
const ally5name = document.getElementById("ally5name").value;

const enemy1name = document.getElementById("enemy1name").value;
const enemy2name = document.getElementById("enemy2name").value;
const enemy3name = document.getElementById("enemy3name").value;
const enemy4name = document.getElementById("enemy4name").value;
const enemy5name = document.getElementById("enemy5name").value;
*/
  // ユーザーが選択したモンスターを見つけ、ally1~配列にデータを格納
  /*
const ally1 = monsters.find(monster => monster.name === ally1name);
const ally2 = monsters.find(monster => monster.name === ally2name);
const ally3 = monsters.find(monster => monster.name === ally3name);
const ally4 = monsters.find(monster => monster.name === ally4name);
const ally5 = monsters.find(monster => monster.name === ally5name);

const enemy1 = monsters.find(monster => monster.name === enemy1name);
const enemy2 = monsters.find(monster => monster.name === enemy2name);
const enemy3 = monsters.find(monster => monster.name === enemy3name);
const enemy4 = monsters.find(monster => monster.name === enemy4name);
const enemy5 = monsters.find(monster => monster.name === enemy5name);
*/
}

function karitobattlepage() {
  document.getElementById("adjustpartypage").style.display = "none";
  document.getElementById("battlepage").style.display = "block";
  startbattle();
  //temporary 戦闘画面移行用
}

/* ゴミ箱




装備もただ下にぶらさげるのではなく、いじる必要
同じモンスターを選択すると、party内の検索がばぐる

注意点
"" ; の忘れ
idとかclassで検索すればわかる


全モンスター選択しないと、displaystatusの初期設定が行われていないからdisplayからdefault出力時にバグる
*/

import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, runTransaction } from 'firebase/database';

// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAsjzcvDVB4AEhk79mgCJt7b2m1QV_zbuE",
  authDomain: "workingnai.firebaseapp.com",
  databaseURL: "https://workingnai-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "workingnai",
  storageBucket: "workingnai.firebasestorage.app",
  messagingSenderId: "G-CX7S8K49BF",
  appId: "1:899110407445:web:3a2634d1c59f855ef16d1c"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const ADMIN_ROLE = "老大";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('我要查詢餘額')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('查詢其他陪陪（老大限定）')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('發薪水(老大限定)')
    .addUserOption(o =>
      o.setName('user').setDescription('選取陪陪').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('amount').setDescription('輸入此單金額').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('date').setDescription('工單日期').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('type').setDescription('遊戲單別').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('boss').setDescription('老闆名字').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('charge')
    .setDescription('提領薪水(老大限定)')
    .addUserOption(o =>
      o.setName('user').setDescription('選取陪陪').setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('amount').setDescription('輸入提領金額').setRequired(true)
    )
];

client.once(Events.ClientReady, async () => {
  console.log(`已上線：${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Slash 指令已註冊");
});

async function getBalance(userId) {
  const snapshot = await get(ref(db, `balances/${userId}`));
  if (!snapshot.exists()) {
    await set(ref(db, `balances/${userId}`), 0);
    return 0;
  }
  return snapshot.val();
}

async function updateBalance(userId, delta) {
  const userRef = ref(db, `balances/${userId}`);
  await runTransaction(userRef, (current) => (current || 0) + delta);
}

async function addTotal(userId, amount) {
  const totalRef = ref(db, `total/${userId}`);
  await runTransaction(totalRef, (current) => (current || 0) + amount);
}

async function getTotal(userId) {
  const snapshot = await get(ref(db, `total/${userId}`));
  return snapshot.exists() ? snapshot.val() : 0;
}

client.on(Events.InteractionCreate, async (i) => {
  if (!i.isChatInputCommand()) return;

  const isAdmin = i.member.roles.cache.some(r => r.name === ADMIN_ROLE);

  if (i.commandName === "balance") {

    const target = i.options.getUser("user") || i.user;

    if (target.id !== i.user.id && !isAdmin) {
      return i.reply({
        content: "陪陪您好，您只能查自己的餘額!",
        ephemeral: true
      });
    }

    const balance = await getBalance(target.id);
    const total = await getTotal(target.id);

    return i.reply({
		content:
		`目前陪陪資訊如下 :
	陪陪ID： ${target.username}\n
	總累積薪資： ${total} 元\n
	目前可提領： ${balance} 元`,
      ephemeral: true
    });
  }

  // ======================
  // add（發薪水）
  // ======================
  if (i.commandName === "add") {

    if (!isAdmin) {
      return i.reply({ content: "您不是老大，無法使用!", ephemeral: true });
    }

    const target = i.options.getUser("user");
    const amount = i.options.getInteger("amount");
    const date = i.options.getString("date");
    const type = i.options.getString("type");
    const boss = i.options.getString("boss");

    if (!amount || amount <= 0) {
      return i.reply({ content: "金額錯誤", ephemeral: true });
    }

    await updateBalance(target.id, amount);
    await addTotal(target.id, amount);

    return i.reply({
		content:
		`發薪完成！
	陪陪ID： ${target.username}\n
	此單金額： ${amount} 元\n
	工單日期： ${date}\n
	遊戲單別： ${type}\n
	老闆名稱： ${boss}`
    });
  }

  if (i.commandName === "charge") {

    if (!isAdmin) {
      return i.reply({ content: "您不是老大，無法使用!", ephemeral: true });
    }

    const target = i.options.getUser("user");
    const amount = i.options.getInteger("amount");

    if (!amount || amount <= 0) {
      return i.reply({ content: "金額錯誤", ephemeral: true });
    }

    const balance = await getBalance(target.id);

    if (balance < amount) {
      return i.reply({ content: "目前餘額不足", ephemeral: true });
    }

    await updateBalance(target.id, -amount);

    return i.reply({
		content: `提領成功！
	陪陪ID： ${target.username}\n
	提領薪水： ${amount} 元\n
	當前剩餘薪水： ${balance - amount} 元`
    });
  }
});

// ======================
if (!process.env.TOKEN) {
  console.error("TOKEN 未設定");
  process.exit(1);
}
client.login(process.env.TOKEN);

const fs = require('fs');
const cron = require("node-cron");

//Инициализация базы данных
let data_base = {};
let DATE = new Date();
data_base = JSON.parse(fs.readFileSync('DATA_BASE.json'));

//Инициализация телеграмм-бота
const TelegramBot = require('node-telegram-bot-api');
const token = data_base["tech_data"]["bot_token"];
const bot = new TelegramBot(token,{polling:true});

const modeMax = 1;
const userModes = ["обычный","заметочный"];

//Отправка уведомления о заметках
cron.schedule("1 0,6,12,18 * * *",() => {
		for(let key in data_base["tech_data"]["usData"]) {
			if ((data_base["tech_data"]["usData"][key]["alert"] === 1) && (data_base["tech_data"]["usData"][key]["tags"].length > 0)) {
				let str = "Заметки с оповещением:";
				let i = 0;
				data_base["tech_data"]["usData"][key]["tags"].forEach((item,index,array) => {
					if (item["alert_status"]>0) {
						str = str+"\n- "+item["text"];
						i++;
					}
				});
				if (i > 0) bot.sendMessage(key,str);
			}
		}
});

//Функция отправки начальной информации
function beginInfo() {
	let str = "Зафиксировано включение бота";
	for (let key in data_base["tech_data"]) {
		if ((key !== "usData") && (key !== "bot_token")) {
			str = str+"\n"+key+": "+data_base["tech_data"][key];
		}
	}
	bot.sendMessage(data_base["tech_data"]["adminId"],str);
}

//Функция поиска объекта в базе данных по путю
function objFromDataBase(str) {
	let arr = str;
	let dataBaseQuery = {};
	if (arr.length > 0) {
		let j = 0;
		dataBaseQuery[j] = "";
		for (let i = 0;i < arr.length;i++) {
			if ((arr[i] === "/") || (arr[i] === "\\")) {
				if (i != arr.length-1) {
					if (((arr[i] === '/') && (arr[i+1] != "/")) || ((arr[i] === '\\') && (arr[i+1] != '\\'))) {
						j++;
						dataBaseQuery[j] = "";
					}
				}
			}
			else {
				dataBaseQuery[j] = dataBaseQuery[j] + arr[i];
			}
		}

		let objNow = data_base;
		let error = 0;
		for (let key in dataBaseQuery) {
			if (dataBaseQuery[key] in objNow)
				objNow = objNow[dataBaseQuery[key]];
			else {
				error = 1;
				break;
			}
		}
		if (error === 0) {
			return objNow;
		}
		else  if (error === 1) {
			return "Не удалось найти файл";
		}
	}
}

//Расшифрофка команд
function comDone(arr) {
	let m = 0;
	let element = {};
	let u = 0;
	element[u] = "";
	for (let i = 0;i < arr.length;i++) {
		if (m === 0) {
			if (arr[i] === ' ') {
				if (arr[i+1] != ' ') {
					u++;
					element[u] = "";
				}
			}
			else if (arr[i] === '"') {
				m = 1;
			}
			else {
				element[u] = element[u] + arr[i];
			}
		}
		else if (m === 1) {
			if ((arr[i] === '"') && (arr[i-1] !== '\\')) {
				m = 0;
			}
			else if (arr[i] === '\\') {

			}
			else {
				element[u] = element[u] + arr[i];
			}
		}
	}
	return element;
}

//Исключения для обычного режима
function exeptionNormalMode(ms) {
	if (data_base["tech_data"]["usData"][ms.chat.id]["dialogMode"] === 1) {
		let cId = data_base["tech_data"]["usData"][ms.chat.id]["dialogUsId"];
		if (cId in data_base["tech_data"]["usData"]) {
			if (data_base["tech_data"]["usData"][cId]["dialogMode"] === 1) {
				if (data_base["tech_data"]["usData"][cId]["dialogUsId"] === ms.chat.id) {
					return 1;
				}
			}
		}
	}
	return 0;
}

//Сохранение данных в базу данных
function saveInDataBase() {
	fs.writeFile('DATA_BASE.json',"", (err) => {
		if (err) throw err;
	});
	fs.writeFile('DATA_BASE.json', JSON.stringify(data_base,undefined,2), (err) => {
		if (err) throw err;
	});
}

beginInfo();

bot.on('message', (msg) => {
	const chatId = msg.chat.id;
	const text = msg.text;
	let enterData = comDone(text);

	//Добавление нового польователя, если его нет в базе данных
	if (!(chatId in data_base["tech_data"]["usData"])) {
		data_base["tech_data"]["usData"][chatId] = {
			name:msg.chat.first_name,
			lastname:msg.chat.last_name,
			mode:0,
			dialogMode: 0,
			dialogUsId: 0,
			history:[],
			alert:1,
			tags:[],
		};

		if (data_base["tech_data"]["Add_alert"] === 1) {
			bot.sendMessage(data_base["tech_data"]["adminId"],"Добавлен новый пользователь:\n"+"Id: "+chatId+"\n"+
															JSON.stringify(data_base["tech_data"]["usData"][chatId],undefined,2));
		}

		saveInDataBase();
	}

	//Запись сообщений в историю сообщений
	DATE = new Date();
	data_base["tech_data"]["usData"][chatId]["history"].push({
		text:text,
		date:DATE,
	});
	//Сохранение данных в базу данных
	saveInDataBase();

	//Административные команды
	if (chatId === data_base["tech_data"]["adminId"]) {
		let comFound = 0;
		//Обновление базы данных
		if (enterData[0] === 'BasaUpdate') {
			data_base = JSON.parse(fs.readFileSync('DATA_BASE.json'));
			bot.sendMessage(data_base["tech_data"]["adminId"], "Данные обновлены");
			comFound = 1;
		}
		//Работа с базой данных
		else if (enterData[0] === 'Database') {
			//Получение части базы по пути
			if (enterData[1] === 'detSearch') {
				if (enterData[2] != undefined)
					bot.sendMessage(data_base["tech_data"]["adminId"], JSON.stringify(objFromDataBase(enterData[2]),undefined,2));
				else
					bot.sendMessage(data_base["tech_data"]["adminId"],"Путь указан неверно");
			}
			//Получение основной информации о пользователях
			else if (enterData[1] === 'usInfo') {
				for (let key in data_base["tech_data"]["usData"]) {
					bot.sendMessage(data_base["tech_data"]["adminId"],"Id: "+key+
													"\nName: "+data_base["tech_data"]["usData"][key]["name"]+
													"\nLastname: "+data_base["tech_data"]["usData"][key]["lastname"]);
				}
			}
			//Очищение истории пользователя по его id
			else if (enterData[1] === 'historyClear') {
				let key = Number(enterData[2]);
				if (!Number.isNaN(key)) {
					if (key in data_base["tech_data"]["usData"]) {
						data_base["tech_data"]["usData"][key]["history"] = [];
						bot.sendMessage(data_base["tech_data"]["adminId"],"История пользователя "+key+" очищена");
					}
					else {
						bot.sendMessage(data_base["tech_data"]["adminId"],"Пользователь не найден");
					}
				}
				else {
					bot.sendMessage(data_base["tech_data"]["adminId"],"Id пользователя указан неверно");
				}
			}
			comFound = 1;
		}
		//Включение и выключение уведомлений о добавлении нового пользователя в базу данных
		else if (enterData[0] === 'AddAlert') {
			if (enterData[1] === 'on') {
				data_base["tech_data"]["Add_alert"] = 1;
				bot.sendMessage(data_base["tech_data"]["adminId"], "Уведомления включены");
			}
			else if (enterData[1] === 'off') {
				data_base["tech_data"]["Add_alert"] = 0;
				bot.sendMessage(data_base["tech_data"]["adminId"], "Уведомления отключены");
			}
			comFound = 1;
		}
		//Создание нового чата для диалогового режима
		else if (enterData[0] === 'NewChat') {
			let id_0 = Number(enterData[1]);
			let id_1 = Number(enterData[2]);
			if (!Number.isNaN(id_0) && !Number.isNaN(id_1)) {
				data_base["tech_data"]["usData"][id_0]["dialogUsId"] = id_1;
				data_base["tech_data"]["usData"][id_1]["dialogUsId"] = id_0;
				bot.sendMessage(data_base["tech_data"]["adminId"], "Чат создан");
			}
			else {
				bot.sendMessage(data_base["tech_data"]["adminId"], "Неверный формат данных");
			}
			comFound = 1;
		}
		//Включение диалогового режима для указаного пользователя
		else if (enterData[0] === 'chatActive') {
			let id = Number(enterData[1]);
			if (!Number.isNaN(id)) {
				data_base["tech_data"]["usData"][id]["dialogMode"] = 1;
				bot.sendMessage(data_base["tech_data"]["adminId"], "Диалоговый режим включён для пользователя " + id);
			}
			else {
				bot.sendMessage(data_base["tech_data"]["adminId"], "Неверный формат данных");
			}
			comFound = 1;
		}
		//Выключение диалогового режима для указаного пользователя
		else if (enterData[0] === 'chatDiactive') {
			let id = Number(enterData[1]);
			if (!Number.isNaN(id)) {
				data_base["tech_data"]["usData"][id]["dialogMode"] = 0;
				bot.sendMessage(data_base["tech_data"]["adminId"], "Диалоговый режим выключен для пользователя " + id);
			}
			else {
				bot.sendMessage(data_base["tech_data"]["adminId"], "Неверный формат данных");
			}
			comFound = 1;
		}
		//Включение административной клавиатуры
		else if (enterData[0] === "Keyboard") {
			bot.sendMessage(data_base["tech_data"]["adminId"],"Активация административной клавиатуры",{
				"reply_markup": {
					"keyboard": [
						["NewChat","chatActive","chatDiactive"],
						["BasaUpdate","Database usInfo","Database detSearch","Database historyClear"],
						["AddAlert on","AddAlert off"]
					]
				}
			});
			comFound = 1;
		}

		if (comFound === 1) {
			saveInDataBase();
			return;
		}
	}

	//Вспомогательные команды
	//Команда для меню информации
	if (text === '/info') {
		let str = "";
		str = "Общие команды:"+
			"\n/info - это меню"+
			"\n/mode - вывод нынешнего режима"+
			"\n/keyboard - включение клавиатуры"+
			"\nОбычный режим:"+
			"\n /start - начало работы"+
			"\n /tagsMode - переход в заметочный режим"+
			"\n /alertOn - включение уведомлений о заметках"+
			"\n /alertOff - выключение уведомлений о заметках"+
			"\nЗаметочный режим (режим работы с заметками):"+
			"\n /normalMode - переход в обычный режим"+
			"\n /show - вывод всех имеющихся заметок"+
			"\n /textEdit [номер заметки] [\"новый текст заметки\"] - замена текста заметки"+
			"\n /alertEdit [номер заметки] [новый статус оповещений заметки] - замена статуса оповещения заметки"+
			"\n /delete [номер позиции заметки] [количество заметок] - удаление определённого количества заметок с определённой позиции"+
			"\n /del - удаление последней заметки"+
			"\n /delAll - удаление всех заметок"+
			"\n";
		if (chatId === data_base["tech_data"]["adminId"]) {
			str = str + "\nАдминистративные команды:"+
						"\nNewChat [id первого пользователя] [id второго пользователя] - создание чата для двух пользователей"+
						"\nchatActive [id пользователя] - включение диалогового режима для указаного пользователя"+
						"\nchatDiactive [id пользователя] - выключение диалогового режима для указаного пользователя"+
						"\nBasaUpdate - обновление базы данных в соответствии с файлом"+
						"\nDatabase detSearch [путь к файлу] - поиск файлов в базе данных по пути"+
						"\nDatabase usInfo - краткая информация о всех пользователях в базе данных"+
						"\nDatabase historyClear [id пользователя] - удаление истории пользователя по его id"+
						"\nAddAlert on/off - включение/выключение уведомлений о добавлении новых пользователей"+
						"\nKeyboard - включение административной клавиатуры"+
						"";
		}
		bot.sendMessage(chatId, str);
		return;
	}
	//Вкючение клавиатуры
	else if (text === '/keyboard') {
		bot.sendMessage(data_base["tech_data"]["adminId"],"Активация пользовательской клавиатуры",{
			"reply_markup": {
				"keyboard": [
					["/tagsMode","/normalMode","/mode"],
					["/start","/alertOn","/alertOff"],
					["/show","/del","/delAll"]
				]
			}
		});
		return;
	}

	//Работа в обычном режиме бота
	if (exeptionNormalMode(msg) === 0) {

		//Вывод нынешнего режима пользователя
		if (text === '/mode') {
			bot.sendMessage(chatId,"Режим пользователя: "+userModes[data_base["tech_data"]["usData"][chatId]["mode"]]);
			return;
		}

		//Работа в обычном режиме пользователя
		if (data_base["tech_data"]["usData"][chatId]["mode"] === 0) {
			//начальная команда
			if (text === '/start') {
				bot.sendMessage(chatId, "Добрый день, "+msg.chat.first_name+"!\nЧем могу помочь?)");
			}
			//Переключение пользователя в заметочный режим
			else if (text === '/tagsMode') {
				data_base["tech_data"]["usData"][chatId]["mode"] = 1;
				bot.sendMessage(chatId,"Режим пользователя: заметочный");
			}
			//Включение уведомлений о заметках
			else if (text === '/alertOn') {
				data_base["tech_data"]["usData"][chatId]["alert"] = 1;
				bot.sendMessage(chatId,"Уведомления о заметках включены");
			}
			//Выключение уведомлений о заметках
			else if (text === '/alertOff') {
				data_base["tech_data"]["usData"][chatId]["alert"] = 0;
				bot.sendMessage(chatId,"Уведомления о заметках выключены");
			}
		}

		//Работа в заметочном режиме пользователя
		else if (data_base["tech_data"]["usData"][chatId]["mode"] === 1) {
			//Смена режима на нормальный
			if (text === '/normalMode') {
				data_base["tech_data"]["usData"][chatId]["mode"] = 0;
				bot.sendMessage(chatId,"Режим пользователя: обычный");
			}
			//Вывод всех имеющихся заметок
			else if (text === '/show') {
				if (data_base["tech_data"]["usData"][chatId]["tags"].length > 0) {
					let str = "Все ваши пометки:";
					data_base["tech_data"]["usData"][chatId]["tags"].forEach((item,index,array) => {
						str = str + "\n["+index+"]["+item["alert_status"]+"]: "+item["text"]+"\n";
					});
					bot.sendMessage(chatId, str);
				}
				else {
					bot.sendMessage(chatId, "Заметки не найдены");
				}
			}
			//Изменение текста заметки
			else if (enterData[0] === '/textEdit') {
				let tag_n = Number(enterData[1]);
				if (!Number.isNaN(tag_n) && enterData[2] != undefined) {
					data_base["tech_data"]["usData"][chatId]["tags"][tag_n]["text"] = enterData[2];
					bot.sendMessage(chatId,"Текст заметки заменён");
				}
				else {
					bot.sendMessage(chatId,"Неверный формат данных");
				}
			}
			//Изменение статуса оповещения заметок
			else if (enterData[0] === '/alertEdit') {
				let tag_n = Number(enterData[1]);
				let status = Number(enterData[2]);
				if (!Number.isNaN(tag_n) && !Number.isNaN(status)) {
					data_base["tech_data"]["usData"][chatId]["tags"][tag_n]["alert_status"] = status;
					bot.sendMessage(chatId,"Статус оповещения заметки заменён");
				}
				else {
					bot.sendMessage(chatId,"Неверный формат данных");
				}
			}
			//Удаление определённого количества заметок с определённой позиции
			else if (enterData[0] === "/delete") {
				let beg = Number(enterData[1]);
				let val = Number(enterData[2]);
				if (!Number.isNaN(beg) && !Number.isNaN(val)) {
					data_base["tech_data"]["usData"][chatId]["tags"].splice(beg,val);
					bot.sendMessage(chatId,"Выбранные заметки удалены");
				}
				else {
					bot.sendMessage(chatId, "Неверный формат введённых данных");
				}
			}
			//Удаление последней заметки
			else if (text === '/del') {
				let len = data_base["tech_data"]["usData"][chatId]["tags"].length;
				if (len > 0) {
					data_base["tech_data"]["usData"][chatId]["tags"].splice(len-1,1);
					bot.sendMessage(chatId,"Последняя заметка удалена");
				}
				else {
					bot.sendMessage(chatId,"Нет заметок для удаления");
				}
			}
			//Удаление всех заметок
			else if (text === '/delAll') {
				data_base["tech_data"]["usData"][chatId]["tags"] = [];
				bot.sendMessage(chatId, "Все заметки удалены");
			}
			//Остальной текст записывается в заметки
			else {
				data_base["tech_data"]["usData"][chatId]["tags"].push({
					text:text,
					alert_status:1,
				});
				bot.sendMessage(chatId, "Заметка добавлена");
			}
		}
	}
	//Работа в диалоговом режиме бота
	else if (exeptionNormalMode(msg) === 1) {
		if (chatId === data_base["tech_data"]["adminId"])
			bot.sendMessage(data_base["tech_data"]["usData"][chatId]["dialogUsId"],text);
		else
			bot.sendMessage(data_base["tech_data"]["usData"][chatId]["dialogUsId"],msg.chat.first_name+"\n"+text);
	}

	//Сохранение данных в базу данных
	saveInDataBase();
});

/* 4-CSE timetable, Group 1: live state.
	Everything here is enhancement; the page is complete without it. */

(function () {
	"use strict";

	const DAYS = ["sun", "mon", "tue", "wed", "thu"];
	const DAYNAMES = { sun: "Sunday", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday" };
	const KINDS = ["course", "td", "tp"];
	const pad = (n) => String(n).padStart(2, "0");
	const toMin = (hm) => {
		const [h, m] = hm.split(":").map(Number);
		return h * 60 + m;
	};
	const hhmm = (mins) => pad(Math.floor(mins / 60)) + "h" + pad(mins % 60);

	const board = document.querySelector(".board");
	if (!board) return;
	const cells = Array.from(board.querySelectorAll(".slot")).map((el) => ({
		el,
		day: el.closest(".day").dataset.day,
		module: el.querySelector(".slot__module").textContent.trim(),
		kind: KINDS.find((k) => el.classList.contains("ty-" + k)),
		room: el.querySelector(".slot__where").textContent.trim(),
		start: toMin(el.dataset.start),
		end: toMin(el.dataset.end),
	}));

	const barLabel = document.getElementById("bar-label");
	const barWhat = document.getElementById("bar-what");
	const barWhen = document.getElementById("bar-when");
	const barDot = document.querySelector(".bar .sq");
	const chip = document.getElementById("chip");
	const departBody = document.getElementById("depart-body");
	const clock = document.getElementById("clock");
	const kindcount = document.getElementById("kindcount");

	/* The clock, the pillar of the search-led bar */
	const tickClock = () => {
		const n = new Date();
		clock.textContent = pad(n.getHours()) + ":" + pad(n.getMinutes());
	};
	tickClock();
	setInterval(tickClock, 30000);

	/* Day switcher: one day on the board, the rest one click away */
	const setDay = (name) => {
		board.classList.add("is-day-on");
		board.querySelectorAll(".day").forEach((d) => {
			d.hidden = d.dataset.day !== name;
		});
	};
	dayInputs().forEach((input) => {
		input.addEventListener("change", () => {
			if (input.checked) setDay(input.value);
			kindcount.textContent = shownCount() + " sessions";
		});
	});

	/* Kind filter: the count beside the segment */
	kindInputs().forEach((input) => {
		input.addEventListener("change", () => {
			board.dataset.kind = input.value;
			kindcount.textContent = shownCount() + " sessions";
		});
	});
	kindcount.textContent = shownCount() + " sessions";

	/* Shared helpers, hoisted so the handlers above resolve */
	function dayInputs() {
		return Array.from(document.querySelectorAll('input[name="day"]'));
	}
	function kindInputs() {
		return Array.from(document.querySelectorAll('input[name="kind"]'));
	}
	function shownDays() {
		return board.classList.contains("is-day-on")
			? [board.querySelector(".day:not([hidden])")]
			: Array.from(board.querySelectorAll(".day:not([hidden])"));
	}
	function shownCount() {
		const kind = board.dataset.kind === "all" ? null : board.dataset.kind;
		let n = 0;
		shownDays().forEach((d) => {
			if (!d) return;
			n += kind
				? d.querySelectorAll(".slot.ty-" + kind).length
				: d.querySelectorAll(".slot").length;
		});
		return n;
	}

	/* The ink board: one row per session of the shown day */
	const buildDepart = (list) => {
		const frag = document.createDocumentFragment();
		list.forEach((c) => {
			const tr = document.createElement("tr");
			tr.dataset.start = c.start;
			tr.dataset.end = c.end;
			const tdWhat = document.createElement("td");
			tdWhat.className = "what";
			tdWhat.textContent = c.module;
			const tag = document.createElement("span");
			tag.className = "whattag";
			tag.textContent = c.kind === "course" ? "Course" : c.kind.toUpperCase();
			tdWhat.appendChild(tag);
			const tdWhen = document.createElement("td");
			tdWhen.className = "when num";
			tdWhen.textContent = hhmm(c.start);
			const tdWhere = document.createElement("td");
			tdWhere.className = "where num";
			tdWhere.textContent = c.room;
			tr.append(tdWhat, tdWhen, tdWhere);
			frag.appendChild(tr);
		});
		departBody.replaceChildren(frag);
	};

	const markRow = (startMin, live) => {
		departBody.querySelectorAll("tr").forEach((tr) => {
			if (+tr.dataset.start === startMin) {
				tr.classList.add("is-now");
				tr.querySelector(".when").textContent = live ? "now" : hhmm(startMin);
			}
		});
	};

	const blinkOnce = () => {
		if (!barDot) return;
		barDot.style.animation = "none";
		void barDot.offsetWidth;
		barDot.style.animation = "";
	};

	/* Bar state: running, next, or the honest empty day */
	let lastState = "";
	const setState = (label, what, when, dot) => {
		const key = label + "|" + what + "|" + when;
		if (key === lastState) return;
		barLabel.textContent = label;
		barWhat.textContent = what;
		barWhen.textContent = when;
		barDot.style.visibility = dot ? "visible" : "hidden";
		if (dot) blinkOnce();
		lastState = key;
	};

	const refresh = () => {
		const n = new Date();
		const now = n.getHours() * 60 + n.getMinutes();
		const d = n.getDay();
		cells.forEach((c) => c.el.classList.remove("is-live"));
		if (d === 5 || d === 6) {
			const sunday = cells.filter((c) => c.day === "sun").sort((a, b) => a.start - b.start);
			buildDepart(sunday);
			chip.textContent = "Sunday";
			setState("The week is off", sunday[0].module, "opens Sunday", false);
			return;
		}

		const today = cells.filter((c) => c.day === DAYS[d]).sort((a, b) => a.start - b.start);
		buildDepart(today);
		chip.textContent = d === 0 ? "Sunday" : "Today, " + DAYNAMES[DAYS[d]];

		const running = today.find((c) => now >= c.start && now < c.end);
		const upcoming = today.filter((c) => c.start > now);

		if (running) {
			running.el.classList.add("is-live");
			setState("Running now", running.module, "until " + hhmm(running.end), true);
			markRow(running.start, true);
			return;
		}

		if (upcoming.length) {
			const next = upcoming[0];
			setState("Next up", next.module, "at " + hhmm(next.start), false);
			markRow(next.start, false);
			return;
		}

		/* The day is over: name the next real session */
		const nextDay = d < 4 ? DAYS[d + 1] : "sun";
		const nextCell = cells.filter((c) => c.day === nextDay).sort((a, b) => a.start - b.start)[0];
		chip.textContent = DAYNAMES[DAYS[d]] + ", the day is over";
		setState("Nothing left today", "Next is " + DAYNAMES[nextDay] + ", " + nextCell.module, nextCell.room + ", " + hhmm(nextCell.start), false);
	};

	/* Pre-JS honesty: the board opens on Sunday, like the default markup */
	setDay("sun");
	kindcount.textContent = shownCount() + " sessions";
	refresh();
	setInterval(refresh, 30000);

	/* Suppress Netlify "Powered by Netlify" injected badge & toolbar */
	try {
		localStorage.setItem("nl-hud:public:v1", JSON.stringify({ hidden: true }));
		localStorage.setItem("nl-hud:public:v1", "true");
	} catch (e) {}

	const removeNetlifyWidgets = () => {
		document.querySelectorAll('iframe, [id*="netlify" i], [class*="netlify" i]').forEach((el) => {
			el.remove();
		});
		document.querySelectorAll('a, button, span').forEach((el) => {
			if (el.textContent && el.textContent.trim().toLowerCase() === "powered by netlify") {
				const wrapper = el.closest("div") || el;
				if (wrapper !== document.body && !wrapper.contains(board)) {
					wrapper.remove();
				}
			}
		});
	};
	removeNetlifyWidgets();
	if (typeof MutationObserver !== "undefined") {
		new MutationObserver(removeNetlifyWidgets).observe(document.documentElement, {
			childList: true,
			subtree: true,
		});
	}
})();

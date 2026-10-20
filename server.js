require("dotenv").config();
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const UPLOADS = path.join(ROOT, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });
const db = new Database(path.join(ROOT, "store.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS books (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL, author TEXT NOT NULL DEFAULT 'Samiul',
 category TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 99,
 description TEXT NOT NULL DEFAULT '', cover TEXT DEFAULT '',
 file TEXT DEFAULT '', published INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, book_id INTEGER NOT NULL, amount INTEGER NOT NULL,
 customer_email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
 payment_method TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);
if (db.prepare("SELECT COUNT(*) n FROM books").get().n === 0) {
  db.prepare("INSERT INTO books(title,author,category,price,description,published) VALUES(?,?,?,?,?,1)")
    .run("অন্তিম রহস্য", "Samiul", "রহস্য", 99, "একটি রহস্যময় ই-বুক। পড়া শুরু করুন, আর প্রবেশ করুন অজানা এক জগতে।");
}
const upload = multer({
  dest: UPLOADS,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".epub", ".png", ".jpg", ".jpeg", ".webp"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  }
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-change-me",
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 2 * 60 * 60 * 1000 }
}));
app.use("/uploads", express.static(UPLOADS));
app.use(express.static(path.join(ROOT, "public")));

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = n => "৳" + Number(n).toLocaleString("en-BD");
const categories = ["সর্বশেষ", "ভৌতিক", "রহস্য", "রোমান্টিক", "মজার গল্প", "শিশু-কিশোর", "কল্পবিজ্ঞান", "অনুপ্রেরণা", "অন্যান্য"];
function page(title, body, admin=false) {
 return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Samiul Publication</title><link rel="stylesheet" href="/style.css"></head><body><header class="top"><a class="brand" href="/">Samiul <span>Publication</span></a><nav><a href="/">হোম</a><a href="/#categories">ক্যাটাগরি</a>${admin?'<a href="/admin">ড্যাশবোর্ড</a>':'<a href="/admin/login">অ্যাডমিন</a>'}</nav></header>${body}<footer>© ${new Date().getFullYear()} Samiul Publication · শুধুমাত্র ই-বুক</footer></body></html>`;
}
function bookCard(b) {
 return `<article class="book"><div class="book-cover">${b.cover?`<img src="/uploads/${esc(b.cover)}" alt="">`:'<div class="cover-placeholder"><span>সামিউল<br>পাবলিকেশন</span><b>'+esc(b.title)+'</b><small>E-BOOK</small></div>'}</div><div class="book-info"><span class="tag">${esc(b.category)}</span><h3>${esc(b.title)}</h3><p>লেখক: ${esc(b.author)}</p><p class="desc">${esc(b.description)}</p><div class="book-bottom"><strong>${money(b.price)}</strong><a class="btn small" href="/book/${b.id}">বই দেখুন</a></div></div></article>`;
}
app.get("/", (req,res) => {
 const all = db.prepare("SELECT * FROM books WHERE published=1 ORDER BY created_at DESC, id DESC").all();
 const grouped = categories.map(c => {
  const list = c==="সর্বশেষ" ? all.slice(0,8) : all.filter(b=>b.category===c);
  return list.length ? `<section class="shelf"><div class="section-head"><div><span class="eyebrow">SAMIUL COLLECTION</span><h2>${c==="সর্বশেষ"?"সর্বশেষ প্রকাশিত":esc(c)}</h2></div><span class="count">${list.length}টি ই-বুক</span></div><div class="books">${list.map(bookCard).join("")}</div></section>` : "";
 }).join("");
 res.send(page("ই-বুক স্টোর", `<main><section class="hero"><div><span class="eyebrow">বাংলা ই-বুকের নতুন ঠিকানা</span><h1>গল্পের ভেতর<br><em>হারিয়ে যান।</em></h1><p>ভৌতিক, রহস্য, রোমান্টিক, মজার গল্প ও শিশু-কিশোরদের জন্য নানা ধরনের ই-বুক—এক জায়গায়।</p><a class="btn" href="#categories">বই ঘুরে দেখুন <span>↗</span></a><div class="hero-note">ডিজিটাল বই · সহজ অর্ডার · নতুন গল্প নিয়মিত</div></div><div class="hero-art"><div class="glow"></div><div class="floating-book"><span>SAMIUL<br>PUBLICATION</span><strong>অন্তিম<br>রহস্য</strong><small>একটি ই-বুক</small></div><div class="orbit orbit1"></div><div class="orbit orbit2"></div></div></section><div id="categories" class="category-strip">${categories.slice(1).map(c=>`<a href="#cat-${encodeURIComponent(c)}">${esc(c)} <span>↗</span></a>`).join("")}</div>${all.length?grouped:'<section class="empty"><h2>প্রথম বইটি শিগগিরই আসছে!</h2><p>অ্যাডমিন ড্যাশবোর্ড থেকে আপনার ই-বুক প্রকাশ করুন।</p></section>'}</main>`, false));
});
app.get("/style.css",(req,res)=>res.type("text/css").send(fs.readFileSync(path.join(ROOT,"public","style.css"),"utf8")));
app.get("/book/:id",(req,res)=>{
 const b=db.prepare("SELECT * FROM books WHERE id=? AND published=1").get(req.params.id);
 if(!b)return res.status(404).send(page("বই পাওয়া যায়নি",'<main class="empty"><h2>বইটি পাওয়া যায়নি</h2><a href="/">হোমে ফিরুন</a></main>'));
 res.send(page(b.title,`<main class="detail"><div class="detail-cover">${b.cover?`<img src="/uploads/${esc(b.cover)}">`:`<div class="cover-placeholder"><span>SAMIUL PUBLICATION</span><b>${esc(b.title)}</b><small>E-BOOK</small></div>`}</div><div class="detail-copy"><span class="tag">${esc(b.category)}</span><h1>${esc(b.title)}</h1><p class="byline">লেখক: ${esc(b.author)}</p><p>${esc(b.description)}</p><div class="price-large">${money(b.price)}</div><form method="post" action="/checkout" class="checkout"><input type="hidden" name="book_id" value="${b.id}"><label>ইমেইল ঠিকানা</label><input type="email" name="email" placeholder="আপনার ইমেইল" required><label>পেমেন্ট পদ্ধতি</label><select name="method"><option value="bkash">বিকাশ</option><option value="nagad">নগদ</option><option value="sslcommerz">কার্ড/অন্যান্য (গেটওয়ে সেটআপের পর)</option></select><button class="btn" type="submit">কিনুন — ${money(b.price)}</button><small>ই-বুক ডাউনলোড লিংক পেমেন্ট নিশ্চিত হওয়ার পরই দেওয়া উচিত।</small></form></div></main>`));
});
function requireAdmin(req,res,next){if(!req.session.admin)return res.redirect("/admin/login");next();}
app.get("/admin/login",(req,res)=>res.send(page("অ্যাডমিন লগইন",`<main class="login-wrap"><form class="panel login" method="post" action="/admin/login"><span class="eyebrow">PRIVATE AREA</span><h1>অ্যাডমিন লগইন</h1><p>শুধুমাত্র Samiul Publication-এর অ্যাডমিনের জন্য।</p><label>ইউজারনেম</label><input name="username" required><label>পাসওয়ার্ড</label><input name="password" type="password" required><button class="btn" type="submit">লগইন করুন</button><a href="/">← স্টোরে ফিরে যান</a></form></main>`)));
app.post("/admin/login",(req,res)=>{
 const u=process.env.ADMIN_USERNAME||"admin", p=process.env.ADMIN_PASSWORD||"change-this-password";
 if(req.body.username===u && req.body.password===p){req.session.admin=true;return res.redirect("/admin");}
 res.status(401).send(page("লগইন ব্যর্থ",'<main class="empty"><h2>লগইন হয়নি</h2><p>তথ্য মিলিয়ে আবার চেষ্টা করুন।</p><a href="/admin/login">আবার চেষ্টা</a></main>'));
});
app.post("/admin/logout",requireAdmin,(req,res)=>req.session.destroy(()=>res.redirect("/")));
app.get("/admin",requireAdmin,(req,res)=>{
 const books=db.prepare("SELECT * FROM books ORDER BY created_at DESC,id DESC").all();
 const orders=db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 30").all();
 const rows=books.map(b=>`<tr><td><b>${esc(b.title)}</b><small>${esc(b.category)}</small></td><td>${money(b.price)}</td><td>${b.published?"প্রকাশিত":"খসড়া"}</td><td><a href="/admin/edit/${b.id}">সম্পাদনা</a> · <form class="inline" method="post" action="/admin/toggle/${b.id}"><button>${b.published?"আড়াল":"প্রকাশ"}</button></form> · <form class="inline" method="post" action="/admin/delete/${b.id}" onsubmit="return confirm('বইটি মুছবেন?')"><button class="danger-text">মুছুন</button></form></td></tr>`).join("");
 const orderRows=orders.map(o=>`<tr><td>${esc(o.id)}</td><td>${esc(o.customer_email)}</td><td>${money(o.amount)}</td><td>${esc(o.status)}</td><td>${esc(o.payment_method||"—")}</td></tr>`).join("");
 res.send(page("অ্যাডমিন ড্যাশবোর্ড",`<main class="admin"><div class="admin-head"><div><span class="eyebrow">CONTROL CENTER</span><h1>আপনার প্রকাশনা, আপনার নিয়ন্ত্রণ</h1><p>বই প্রকাশ করুন, ক্যাটাগরি ও দাম ঠিক করুন, অর্ডার দেখুন।</p></div><form method="post" action="/admin/logout"><button class="btn ghost">লগআউট</button></form></div><div class="stats"><div><span>মোট বই</span><b>${books.length}</b></div><div><span>প্রকাশিত বই</span><b>${books.filter(b=>b.published).length}</b></div><div><span>অর্ডার রেকর্ড</span><b>${orders.length}</b></div></div><section class="panel"><div class="section-head"><div><span class="eyebrow">LIBRARY</span><h2>বই পরিচালনা</h2></div><a class="btn" href="/admin/new">+ নতুন ই-বুক</a></div><div class="table-wrap"><table><thead><tr><th>বই</th><th>দাম</th><th>স্ট্যাটাস</th><th>অ্যাকশন</th></tr></thead><tbody>${rows||'<tr><td colspan="4">এখনও বই নেই।</td></tr>'}</tbody></table></div></section><section class="panel"><div class="section-head"><div><span class="eyebrow">ORDERS</span><h2>সাম্প্রতিক অর্ডার</h2></div></div><p class="notice">লাইভ পেমেন্ট গেটওয়ে যুক্ত না করা পর্যন্ত অর্ডারগুলো পেমেন্ট-নিশ্চিত হিসেবে গণ্য করবেন না।</p><div class="table-wrap"><table><thead><tr><th>অর্ডার</th><th>ইমেইল</th><th>দাম</th><th>স্ট্যাটাস</th><th>পদ্ধতি</th></tr></thead><tbody>${orderRows||'<tr><td colspan="5">এখনও অর্ডার নেই।</td></tr>'}</tbody></table></div></section><section class="panel"><h2>নতুন ফিচার যোগ করার নোট</h2><p>ক্যাটাগরি, বইয়ের ফর্ম, পেমেন্ট গেটওয়ে ও অর্ডার ব্যবস্থাপনা আলাদা রুটে রাখা হয়েছে—ডেভেলপার দিয়ে নতুন মডিউল যোগ করা যাবে। এই ভার্সনে ক্যাটাগরি তালিকা কোডে নির্ধারিত; পরের ধাপে ড্যাশবোর্ড থেকেই ক্যাটাগরি যোগ/মুছার সুবিধা করা যায়।</p></section></main>` ,true));
});
function bookForm(b={}) {
 return `<main class="admin"><a href="/admin" class="back">← ড্যাশবোর্ড</a><section class="panel form-panel"><span class="eyebrow">E-BOOK PUBLISHER</span><h1>${b.id?"বই সম্পাদনা":"নতুন ই-বুক প্রকাশ"}</h1><form method="post" enctype="multipart/form-data" action="${b.id?`/admin/edit/${b.id}`:"/admin/new"}"><label>বইয়ের নাম</label><input name="title" required value="${esc(b.title||"")}"><label>লেখকের নাম</label><input name="author" required value="${esc(b.author||"Samiul")}"><label>ক্যাটাগরি</label><select name="category">${categories.slice(1).map(c=>`<option ${b.category===c?"selected":""}>${esc(c)}</option>`).join("")}</select><label>দাম (টাকা)</label><input type="number" min="0" step="1" name="price" required value="${Number(b.price??99)}"><label>বইয়ের বিবরণ</label><textarea name="description" rows="4">${esc(b.description||"")}</textarea><label>কভার ছবি (ঐচ্ছিক)</label><input type="file" name="cover" accept=".png,.jpg,.jpeg,.webp"><label>ই-বুক ফাইল PDF/EPUB (ঐচ্ছিক)</label><input type="file" name="ebook" accept=".pdf,.epub"><label class="check"><input type="checkbox" name="published" value="1" ${b.published===0?"":"checked"}> এখনই প্রকাশ করুন</label><button class="btn" type="submit">${b.id?"পরিবর্তন সংরক্ষণ":"বই প্রকাশ করুন"}</button><p class="notice">ফাইলের সর্বোচ্চ সাইজ ২৫ MB। এই ডেমোতে নিরাপদ ডাউনলোড ও পেমেন্ট যাচাই আলাদাভাবে সম্পূর্ণ করতে হবে।</p></form></section></main>`;
}
app.get("/admin/new",requireAdmin,(req,res)=>res.send(page("নতুন ই-বুক",bookForm(),true)));
app.post("/admin/new",requireAdmin,upload.fields([{name:"cover",maxCount:1},{name:"ebook",maxCount:1}]),(req,res)=>{
 const f=req.files||{}, cover=f.cover?.[0], ebook=f.ebook?.[0];
 const move=(file)=>{if(!file)return "";const ext=path.extname(file.originalname).toLowerCase();const name=crypto.randomBytes(12).toString("hex")+ext;fs.renameSync(file.path,path.join(UPLOADS,name));return name;};
 db.prepare("INSERT INTO books(title,author,category,price,description,cover,file,published) VALUES(?,?,?,?,?,?,?,?)")
 .run(req.body.title,req.body.author,req.body.category,Math.max(0,parseInt(req.body.price||"0",10)),req.body.description||"",move(cover),move(ebook),req.body.published==="1"?1:0);
 res.redirect("/admin");
});
app.get("/admin/edit/:id",requireAdmin,(req,res)=>{const b=db.prepare("SELECT * FROM books WHERE id=?").get(req.params.id);if(!b)return res.redirect("/admin");res.send(page("বই সম্পাদনা",bookForm(b),true));});
app.post("/admin/edit/:id",requireAdmin,upload.fields([{name:"cover",maxCount:1},{name:"ebook",maxCount:1}]),(req,res)=>{
 const b=db.prepare("SELECT * FROM books WHERE id=?").get(req.params.id);if(!b)return res.redirect("/admin");
 const f=req.files||{}, cover=f.cover?.[0], ebook=f.ebook?.[0];
 const move=file=>{if(!file)return null;const ext=path.extname(file.originalname).toLowerCase();const name=crypto.randomBytes(12).toString("hex")+ext;fs.renameSync(file.path,path.join(UPLOADS,name));return name;};
 db.prepare("UPDATE books SET title=?,author=?,category=?,price=?,description=?,cover=?,file=?,published=? WHERE id=?")
 .run(req.body.title,req.body.author,req.body.category,Math.max(0,parseInt(req.body.price||"0",10)),req.body.description||"",move(cover)||b.cover,move(ebook)||b.file,req.body.published==="1"?1:0,b.id);
 res.redirect("/admin");
});
app.post("/admin/toggle/:id",requireAdmin,(req,res)=>{db.prepare("UPDATE books SET published=1-published WHERE id=?").run(req.params.id);res.redirect("/admin");});
app.post("/admin/delete/:id",requireAdmin,(req,res)=>{db.prepare("DELETE FROM books WHERE id=?").run(req.params.id);res.redirect("/admin");});
app.post("/checkout",(req,res)=>{
 const b=db.prepare("SELECT * FROM books WHERE id=? AND published=1").get(req.body.book_id);
 if(!b || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email||"")) return res.status(400).send(page("অর্ডার সমস্যা",'<main class="empty"><h2>অর্ডার নেওয়া যায়নি</h2><a href="/">ফিরে যান</a></main>'));
 const id="SP-"+crypto.randomBytes(5).toString("hex").toUpperCase();
 db.prepare("INSERT INTO orders(id,book_id,amount,customer_email,status,payment_method) VALUES(?,?,?,?,?,?)").run(id,b.id,b.price,req.body.email,"pending",req.body.method||"manual");
 // Never grant downloads from a browser form alone. Real provider callback verification must mark orders paid.
 res.send(page("অর্ডার তৈরি হয়েছে",`<main class="empty"><div class="order-icon">✓</div><span class="eyebrow">ORDER CREATED</span><h1>আপনার অর্ডার তৈরি হয়েছে</h1><p>অর্ডার নম্বর: <b>${id}</b></p><p>${esc(b.title)} · ${money(b.price)}</p><p class="notice">এটি এখনো পেমেন্ট নয়। লাইভ বিকাশ/নগদ/কার্ড পেমেন্ট চালু করতে মার্চেন্ট অ্যাকাউন্ট, গেটওয়ে ক্রেডেনশিয়াল ও সার্ভার-সাইড পেমেন্ট যাচাই যুক্ত করতে হবে। কোনো টাকা কাটা হয়নি।</p><a class="btn" href="/">আরও বই দেখুন</a></main>`));
});
app.get("/health",(req,res)=>res.json({ok:true,app:"Samiul Publication"}));
app.listen(PORT,()=>console.log(`Samiul Publication running at http://localhost:${PORT}`));

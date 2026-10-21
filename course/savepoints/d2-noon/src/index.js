// Worker 入口（參考解答）：把店的資料交給 core.js，D1 與 Workers AI 由 Cloudflare 綁定進來。
// 學員 repo 的 src/ 由主管（CC）自己蓋；這份是講師的答案，放進組裝出的 repo 的 src/ 才會動。
import { createApp } from './core.js';
import products from '../data/products.csv';
import staff from '../data/staff.csv';
import orders from '../data/orders.csv';
import customers from '../data/customers.csv';
import equipment from '../data/equipment.csv';
import shifts from '../data/shifts.csv';
import notes from '../company-data/aunt-zhu-notes.md';
import menu from '../company-data/menu-items.md';
import options from '../company-data/custom-cake-options.md';

const app = createApp({ products, staff, orders, customers, equipment, shifts, rules: [notes, menu, options].join('\n\n') });
export default { fetch: (req, env) => app.fetch(req, env) };

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pdip_banjarnegara',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware to check database connectivity
app.use(async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    connection.release();
    next();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    res.status(503).json({ 
      error: 'Database connection failed', 
      message: 'MySQL server is offline or database configuration is incorrect.' 
    });
  }
});

// ==================== 1. SYSTEM STATUS & SEEDING ====================

// Check if database needs seeding
app.get('/api/status', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM members');
    res.json({ 
      connected: true, 
      needsSeeding: rows[0].count === 0,
      memberCount: rows[0].count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Seeding endpoint
app.post('/api/seed', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { 
      members, 
      logisticsItems, 
      logisticsOrders, 
      aspirations, 
      quickCounts, 
      memberReports, 
      privateMessages 
    } = req.body;

    console.log('Seeding database with frontend data...');

    // Clear existing data in reverse order of foreign key dependencies
    await connection.query('DELETE FROM audit_logs');
    await connection.query('DELETE FROM private_messages');
    await connection.query('DELETE FROM member_reports');
    await connection.query('DELETE FROM ranting_proposals');
    await connection.query('DELETE FROM aspirations');
    await connection.query('DELETE FROM logistics_orders');
    await connection.query('DELETE FROM logistics_items');
    await connection.query('UPDATE members SET parent_id = NULL');
    await connection.query('DELETE FROM members');
    await connection.query('DELETE FROM quick_count_results');

    // 1. Seed Members (Group 1: without parentId first to satisfy self-referential FK)
    if (members && members.length > 0) {
      // First insert all members with parent_id set to NULL
      for (const m of members) {
        await connection.query(
          `INSERT INTO members (id, name, kta_number, nik, role, kecamatan, desa, tps, photo_url, lat, lng, phone, status, join_date, parent_id, dapil, party_affiliation) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
          [m.id, m.name, m.ktaNumber, m.nik, m.role, m.kecamatan, m.desa, m.tps, m.photoUrl, m.lat, m.lng, m.phone, m.status || 'ACTIVE', m.joinDate, m.dapil || null, m.partyAffiliation || null]
        );
      }
      // Then update parent_ids
      for (const m of members) {
        if (m.parentId) {
          await connection.query(
            'UPDATE members SET parent_id = ? WHERE id = ?',
            [m.parentId, m.id]
          );
        }
      }
    }

    // 2. Seed Logistics Items
    if (logisticsItems && logisticsItems.length > 0) {
      for (const item of logisticsItems) {
        await connection.query(
          'INSERT INTO logistics_items (id, name, sku, stock, location, category) VALUES (?, ?, ?, ?, ?, ?)',
          [item.id, item.name, item.sku, item.stock, item.location, item.category]
        );
      }
    }

    // 3. Seed Logistics Orders
    if (logisticsOrders && logisticsOrders.length > 0) {
      for (const o of logisticsOrders) {
        await connection.query(
          'INSERT INTO logistics_orders (id, requester_name, requester_role, kecamatan, desa, item_name, quantity, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [o.id, o.requesterName, o.requesterRole, o.kecamatan, o.desa, o.itemName, o.quantity, o.status, o.createdAt]
        );
      }
    }

    // 4. Seed Aspirations
    if (aspirations && aspirations.length > 0) {
      for (const a of aspirations) {
        await connection.query(
          'INSERT INTO aspirations (id, reporter_name, kecamatan, desa, phone, title, description, status, date, dewan_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [a.id, a.reporterName, a.kecamatan, a.desa, a.phone, a.title, a.description, a.status, a.date, a.dewanResponse || null]
        );
      }
    }

    // 5. Seed Quick Counts
    if (quickCounts && quickCounts.length > 0) {
      for (const q of quickCounts) {
        await connection.query(
          `INSERT INTO quick_count_results (kecamatan, tps, candidate1_votes, candidate2_votes, candidate3_votes, sah, tidak_sah, c1_photo_url, submitted_by, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [q.kecamatan, q.tps, q.candidate1Votes, q.candidate2Votes, q.candidate3Votes, q.sah, q.tidakSah, q.c1PhotoUrl || '', q.submittedBy, q.timestamp]
        );
      }
    }

    // 6. Seed Member Reports
    if (memberReports && memberReports.length > 0) {
      for (const r of memberReports) {
        await connection.query(
          `INSERT INTO member_reports (id, title, timestamp, category, details, photo_url, submitted_by, submitter_id, kecamatan, target_member_id, target_member_name) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.title, r.timestamp, r.category, r.details, r.photoUrl || null, r.submittedBy, r.submitterId, r.kecamatan, r.targetMemberId || null, r.targetMemberName || null]
        );
      }
    }

    // 7. Seed Private Messages
    if (privateMessages && privateMessages.length > 0) {
      for (const msg of privateMessages) {
        await connection.query(
          'INSERT INTO private_messages (id, sender_id, sender_name, receiver_id, receiver_name, content, timestamp, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [msg.id, msg.senderId, msg.senderName, msg.receiverId, msg.receiverName, msg.content, msg.timestamp, msg.read ? 1 : 0]
        );
      }
    }

    // Insert an initial audit log for seeding
    await connection.query(
      'INSERT INTO audit_logs (timestamp, user, action) VALUES (?, ?, ?)',
      [new Date().toISOString().slice(0, 19).replace('T', ' '), 'Sistem', 'Melakukan seeding awal database dari mock data frontend']
    );

    await connection.commit();
    console.log('Seeding completed successfully!');
    res.json({ success: true, message: 'Database seeded successfully!' });
  } catch (error) {
    await connection.rollback();
    console.error('Seeding failed:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// ==================== 2. MEMBERS ROUTE ====================

app.get('/api/members', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM members ORDER BY join_date DESC');
    // Map database snake_case fields back to camelCase for frontend
    const members = rows.map(r => ({
      id: r.id,
      name: r.name,
      ktaNumber: r.kta_number,
      nik: r.nik,
      role: r.role,
      kecamatan: r.kecamatan,
      desa: r.desa,
      tps: r.tps,
      photoUrl: r.photo_url,
      lat: r.lat,
      lng: r.lng,
      phone: r.phone,
      status: r.status,
      joinDate: r.join_date,
      parentId: r.parent_id || undefined,
      dapil: r.dapil || undefined,
      partyAffiliation: r.party_affiliation || undefined
    }));
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/members', async (req, res) => {
  try {
    const m = req.body;
    await pool.query(
      `INSERT INTO members (id, name, kta_number, nik, role, kecamatan, desa, tps, photo_url, lat, lng, phone, status, join_date, parent_id, dapil, party_affiliation) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         kta_number = VALUES(kta_number),
         role = VALUES(role),
         kecamatan = VALUES(kecamatan),
         desa = VALUES(desa),
         tps = VALUES(tps),
         photo_url = VALUES(photo_url),
         lat = VALUES(lat),
         lng = VALUES(lng),
         phone = VALUES(phone),
         status = VALUES(status),
         parent_id = VALUES(parent_id),
         dapil = VALUES(dapil),
         party_affiliation = VALUES(party_affiliation)`,
      [
        m.id, m.name, m.ktaNumber, m.nik, m.role, m.kecamatan, m.desa, m.tps, 
        m.photoUrl, m.lat, m.lng, m.phone, m.status || 'ACTIVE', m.joinDate, 
        m.parentId || null, m.dapil || null, m.partyAffiliation || null
      ]
    );
    res.json({ success: true, member: m });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/members/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Set parent_id of downlines to null first
    await pool.query('UPDATE members SET parent_id = NULL WHERE parent_id = ?', [id]);
    await pool.query('DELETE FROM members WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 3. LOGISTICS ROUTE ====================

app.get('/api/logistics', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM logistics_items');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/logistics/orders', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM logistics_orders ORDER BY created_at DESC');
    const orders = rows.map(r => ({
      id: r.id,
      requesterName: r.requester_name,
      requesterRole: r.requester_role,
      kecamatan: r.kecamatan,
      desa: r.desa,
      itemName: r.item_name,
      quantity: r.quantity,
      status: r.status,
      createdAt: r.created_at
    }));
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/logistics/orders', async (req, res) => {
  try {
    const o = req.body;
    await pool.query(
      'INSERT INTO logistics_orders (id, requester_name, requester_role, kecamatan, desa, item_name, quantity, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [o.id, o.requesterName, o.requesterRole, o.kecamatan, o.desa, o.itemName, o.quantity, o.status, o.createdAt]
    );
    res.json({ success: true, order: o });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/logistics/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Begin transaction for stocks change if order status changes
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Get order details
      const [orderRows] = await connection.query('SELECT * FROM logistics_orders WHERE id = ?', [id]);
      if (orderRows.length === 0) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      const order = orderRows[0];
      const prevStatus = order.status;

      // Update status
      await connection.query('UPDATE logistics_orders SET status = ? WHERE id = ?', [status, id]);
      
      // Deduct stock if order becomes approved/packed (assuming stock reduction happens on approval)
      if ((status === 'approved' || status === 'packed') && prevStatus === 'draft') {
        await connection.query(
          'UPDATE logistics_items SET stock = GREATEST(0, stock - ?) WHERE name = ?',
          [order.quantity, order.item_name]
        );
      }
      
      // Restock if order is canceled (e.g. reset from approved to draft)
      if (status === 'draft' && (prevStatus === 'approved' || prevStatus === 'packed' || prevStatus === 'shipped')) {
        await connection.query(
          'UPDATE logistics_items SET stock = stock + ? WHERE name = ?',
          [order.quantity, order.item_name]
        );
      }

      await connection.commit();
      res.json({ success: true });
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 4. ASPIRATIONS ROUTE ====================

app.get('/api/aspirations', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM aspirations ORDER BY date DESC');
    const aspirations = rows.map(r => ({
      id: r.id,
      reporterName: r.reporter_name,
      kecamatan: r.kecamatan,
      desa: r.desa,
      phone: r.phone,
      title: r.title,
      description: r.description,
      status: r.status,
      date: r.date,
      dewanResponse: r.dewan_response || undefined
    }));
    res.json(aspirations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/aspirations', async (req, res) => {
  try {
    const a = req.body;
    await pool.query(
      'INSERT INTO aspirations (id, reporter_name, kecamatan, desa, phone, title, description, status, date, dewan_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [a.id, a.reporterName, a.kecamatan, a.desa, a.phone, a.title, a.description, a.status, a.date, a.dewanResponse || null]
    );
    res.json({ success: true, aspiration: a });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/aspirations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dewanResponse, status } = req.body;
    await pool.query(
      'UPDATE aspirations SET dewan_response = ?, status = ? WHERE id = ?',
      [dewanResponse || null, status, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 5. QUICK COUNT ROUTE ====================

app.get('/api/quickcount', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM quick_count_results ORDER BY timestamp DESC');
    const qcs = rows.map(r => ({
      kecamatan: r.kecamatan,
      tps: r.tps,
      candidate1Votes: r.candidate1_votes,
      candidate2Votes: r.candidate2_votes,
      candidate3Votes: r.candidate3_votes,
      sah: r.sah,
      tidakSah: r.tidak_sah,
      c1PhotoUrl: r.c1_photo_url,
      submittedBy: r.submitted_by,
      timestamp: r.timestamp
    }));
    res.json(qcs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quickcount', async (req, res) => {
  try {
    const q = req.body;
    await pool.query(
      `INSERT INTO quick_count_results (kecamatan, tps, candidate1_votes, candidate2_votes, candidate3_votes, sah, tidak_sah, c1_photo_url, submitted_by, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
         candidate1_votes = VALUES(candidate1_votes),
         candidate2_votes = VALUES(candidate2_votes),
         candidate3_votes = VALUES(candidate3_votes),
         sah = VALUES(sah),
         tidak_sah = VALUES(tidak_sah),
         c1_photo_url = VALUES(c1_photo_url),
         submitted_by = VALUES(submitted_by),
         timestamp = VALUES(timestamp)`,
      [q.kecamatan, q.tps, q.candidate1Votes, q.candidate2Votes, q.candidate3Votes, q.sah, q.tidakSah, q.c1PhotoUrl || '', q.submittedBy, q.timestamp]
    );
    res.json({ success: true, quickCount: q });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 6. MEMBER REPORTS ROUTE ====================

app.get('/api/reports', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM member_reports ORDER BY timestamp DESC');
    const reports = rows.map(r => ({
      id: r.id,
      title: r.title,
      timestamp: r.timestamp,
      category: r.category,
      details: r.details,
      photoUrl: r.photo_url || undefined,
      submittedBy: r.submitted_by,
      submitterId: r.submitter_id,
      kecamatan: r.kecamatan,
      targetMemberId: r.target_member_id || undefined,
      targetMemberName: r.target_member_name || undefined
    }));
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const r = req.body;
    await pool.query(
      `INSERT INTO member_reports (id, title, timestamp, category, details, photo_url, submitted_by, submitter_id, kecamatan, target_member_id, target_member_name) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.title, r.timestamp, r.category, r.details, r.photoUrl || null, r.submittedBy, r.submitterId, r.kecamatan, r.targetMemberId || null, r.targetMemberName || null]
    );
    res.json({ success: true, report: r });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 7. PRIVATE MESSAGES ROUTE ====================

app.get('/api/messages', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM private_messages ORDER BY timestamp ASC');
    const messages = rows.map(r => ({
      id: r.id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      receiverId: r.receiver_id,
      receiverName: r.receiver_name,
      content: r.content,
      timestamp: r.timestamp,
      read: r.is_read === 1
    }));
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const msg = req.body;
    await pool.query(
      'INSERT INTO private_messages (id, sender_id, sender_name, receiver_id, receiver_name, content, timestamp, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [msg.id, msg.senderId, msg.senderName, msg.receiverId, msg.receiverName, msg.content, msg.timestamp, msg.read ? 1 : 0]
    );
    res.json({ success: true, message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/messages/read', async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    await pool.query(
      'UPDATE private_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [senderId, receiverId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM private_messages WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages/clear', async (req, res) => {
  try {
    const { userA, userB } = req.body;
    await pool.query(
      'DELETE FROM private_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [userA, userB, userB, userA]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 8. RANTING PROPOSALS ROUTE ====================

app.get('/api/ranting-proposals', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ranting_proposals ORDER BY created_at DESC');
    const proposals = rows.map(r => ({
      id: r.id,
      kecamatan: r.kecamatan,
      desa: r.desa,
      proposedKetuaName: r.proposed_ketua_name,
      proposedKetuaNik: r.proposed_ketua_nik,
      proposedKetuaPhone: r.proposed_ketua_phone,
      description: r.description,
      status: r.status,
      createdAt: r.created_at
    }));
    res.json(proposals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ranting-proposals', async (req, res) => {
  try {
    const p = req.body;
    await pool.query(
      'INSERT INTO ranting_proposals (id, kecamatan, desa, proposed_ketua_name, proposed_ketua_nik, proposed_ketua_phone, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [p.id, p.kecamatan, p.desa, p.proposedKetuaName, p.proposedKetuaNik, p.proposedKetuaPhone, p.description, p.status, p.createdAt]
    );
    res.json({ success: true, proposal: p });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/ranting-proposals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.query('UPDATE ranting_proposals SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 9. AUDIT LOGS ROUTE ====================

app.get('/api/audit-logs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50');
    const logs = rows.map(r => ({
      time: r.timestamp,
      user: r.user,
      action: r.action
    }));
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audit-logs', async (req, res) => {
  try {
    const { user, action } = req.body;
    const time = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      'INSERT INTO audit_logs (timestamp, user, action) VALUES (?, ?, ?)',
      [time, user, action]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static frontend files if dist folder exists
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend build not found. Please run "npm run build" in the root directory of the project.');
    }
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5005;

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

// Ensure approach columns exist in members table
(async () => {
  try {
    const connection = await pool.getConnection();
    const [columns] = await connection.query('SHOW COLUMNS FROM members');
    const columnNames = columns.map(c => c.Field);
    
    if (!columnNames.includes('approach_status')) {
      await connection.query("ALTER TABLE members ADD COLUMN approach_status VARCHAR(30) NULL");
      console.log('Added column approach_status to members');
    }
    if (!columnNames.includes('approach_kader_id')) {
      await connection.query("ALTER TABLE members ADD COLUMN approach_kader_id VARCHAR(50) NULL");
      console.log('Added column approach_kader_id to members');
    }
    if (!columnNames.includes('approach_notes')) {
      await connection.query("ALTER TABLE members ADD COLUMN approach_notes TEXT NULL");
      console.log('Added column approach_notes to members');
    }

    // Check if tps_mapping table exists, if not create it
    const [tpsTables] = await connection.query("SHOW TABLES LIKE 'tps_mapping'");
    if (tpsTables.length === 0) {
      await connection.query(`
        CREATE TABLE tps_mapping (
          id VARCHAR(50) PRIMARY KEY,
          nama_tps VARCHAR(100) NOT NULL,
          kecamatan VARCHAR(50) NOT NULL,
          desa VARCHAR(50) NOT NULL,
          lat DOUBLE NOT NULL,
          lng DOUBLE NOT NULL,
          zona VARCHAR(10) NOT NULL,
          dpt_count INT NOT NULL DEFAULT 0,
          last_updated_by VARCHAR(100) NOT NULL,
          last_updated_date VARCHAR(30) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('Created tps_mapping table');
    }

    connection.release();
  } catch (err) {
    console.error('Migration failed or DB offline:', err.message);
  }
})();

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
      privateMessages,
      operational_funds,
      logisticsStockHistory,
      activities,
      tpsMapping
      } = req.body;


    console.log('Seeding database with frontend data...');

    // Clear existing data in reverse order of foreign key dependencies
    await connection.query('DELETE FROM audit_logs');
    await connection.query('DELETE FROM private_messages');
    await connection.query('DELETE FROM member_reports');
    await connection.query('DELETE FROM ranting_proposals');
    await connection.query('DELETE FROM aspirations');
    await connection.query('DELETE FROM logistics_orders');
    await connection.query('DELETE FROM logistics_stock_history');
    await connection.query('DELETE FROM logistics_items');
    await connection.query('UPDATE members SET parent_id = NULL');
    await connection.query('DELETE FROM members');
    await connection.query('DELETE FROM quick_count_results');
    await connection.query('DELETE FROM operational_funds');
    await connection.query('DELETE FROM activities');
    await connection.query('DELETE FROM tps_mapping');

    // 1. Seed Members (Group 1: without parentId first to satisfy self-referential FK)
    if (members && members.length > 0) {
      // First insert all members with parent_id set to NULL
      for (const m of members) {
        await connection.query(
          `INSERT INTO members (id, name, kta_number, nik, role, kecamatan, desa, tps, photo_url, lat, lng, phone, status, join_date, parent_id, dapil, party_affiliation, approach_status, approach_kader_id, approach_notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
          [m.id, m.name, m.ktaNumber, m.nik, m.role, m.kecamatan, m.desa, m.tps, m.photoUrl, m.lat, m.lng, m.phone, m.status || 'ACTIVE', m.joinDate, m.dapil || null, m.partyAffiliation || null, m.approachStatus || null, m.approachKaderId || null, m.approachNotes || null]
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

    // 8. Seed Operational Funds
    if (operationalFunds && operationalFunds.length > 0) {
      for (const f of operationalFunds) {
        await connection.query(
          'INSERT INTO operational_funds (id, type, amount, category, title, description, date, submitter_id, submitter_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [f.id, f.type, f.amount, f.category, f.title, f.description, f.date, f.submitterId, f.submitterName]
        );
      }
    }

    // 9. Seed Logistics Stock History
    if (logisticsStockHistory && logisticsStockHistory.length > 0) {
      for (const sh of logisticsStockHistory) {
        await connection.query(
          'INSERT INTO logistics_stock_history (id, item_id, item_name, type, quantity, notes, date, submitter_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [sh.id, sh.itemId, sh.itemName, sh.type, sh.quantity, sh.notes, sh.date, sh.submitterName]
        );
      }
    }

    // 10. Seed Activities
    if (activities && activities.length > 0) {
      for (const act of activities) {
        const executorsJson = JSON.stringify(act.executors);
        await connection.query(
          `INSERT INTO activities (id, title, type, executors, date, location, status, 
           budget_transport, budget_meals, budget_accommodation, budget_other, budget_total, 
           report_description, report_photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            act.id, act.title, act.type, executorsJson, act.date, act.location, act.status,
            act.budgetTransport, act.budgetMeals, act.budgetAccommodation, act.budgetOther, act.budgetTotal,
            act.reportDescription || null, act.reportPhoto || null
          ]
        );
      }
    }

    // 11. Seed TPS Mapping
    if (tpsMapping && tpsMapping.length > 0) {
      for (const t of tpsMapping) {
        await connection.query(
          `INSERT INTO tps_mapping (id, nama_tps, kecamatan, desa, lat, lng, zona, dpt_count, last_updated_by, last_updated_date) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.namaTps, t.kecamatan, t.desa, t.lat, t.lng, t.zona, t.dptCount, t.lastUpdatedBy, t.lastUpdatedDate]
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
      partyAffiliation: r.party_affiliation || undefined,
      approachStatus: r.approach_status || undefined,
      approachKaderId: r.approach_kader_id || undefined,
      approachNotes: r.approach_notes || undefined
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
      `INSERT INTO members (id, name, kta_number, nik, role, kecamatan, desa, tps, photo_url, lat, lng, phone, status, join_date, parent_id, dapil, party_affiliation, approach_status, approach_kader_id, approach_notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
         party_affiliation = VALUES(party_affiliation),
         approach_status = VALUES(approach_status),
         approach_kader_id = VALUES(approach_kader_id),
         approach_notes = VALUES(approach_notes)`,
      [
        m.id, m.name, m.ktaNumber, m.nik, m.role, m.kecamatan, m.desa, m.tps, 
        m.photoUrl, m.lat, m.lng, m.phone, m.status || 'ACTIVE', m.joinDate, 
        m.parentId || null, m.dapil || null, m.partyAffiliation || null,
        m.approachStatus || null, m.approachKaderId || null, m.approachNotes || null
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

// ==================== 10. OPERATIONAL FUNDS ROUTE ====================

app.get('/api/funds', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM operational_funds ORDER BY date DESC');
    const funds = rows.map(r => ({
      id: r.id,
      type: r.type,
      amount: parseFloat(r.amount),
      category: r.category,
      title: r.title,
      description: r.description,
      date: r.date,
      submitterId: r.submitter_id,
      submitterName: r.submitter_name
    }));
    res.json(funds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/funds', async (req, res) => {
  try {
    const f = req.body;
    await pool.query(
      'INSERT INTO operational_funds (id, type, amount, category, title, description, date, submitter_id, submitter_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [f.id, f.type, f.amount, f.category, f.title, f.description, f.date, f.submitterId, f.submitterName]
    );
    res.json({ success: true, transaction: f });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/funds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM operational_funds WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 11. LOGISTICS STOCK HISTORY ROUTE ====================

app.get('/api/logistics/history', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM logistics_stock_history ORDER BY date DESC');
    const history = rows.map(r => ({
      id: r.id,
      itemId: r.item_id,
      itemName: r.item_name,
      type: r.type,
      quantity: r.quantity,
      notes: r.notes,
      date: r.date,
      submitterName: r.submitter_name
    }));
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/logistics/history', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const sh = req.body;
    
    // 1. Insert history log
    await connection.query(
      'INSERT INTO logistics_stock_history (id, item_id, item_name, type, quantity, notes, date, submitter_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sh.id, sh.itemId, sh.itemName, sh.type, sh.quantity, sh.notes, sh.date, sh.submitterName]
    );

    // 2. Adjust inventory stock count in logistics_items
    if (sh.type === 'stock_in') {
      await connection.query(
        'UPDATE logistics_items SET stock = stock + ? WHERE id = ?',
        [sh.quantity, sh.itemId]
      );
    } else if (sh.type === 'stock_out') {
      await connection.query(
        'UPDATE logistics_items SET stock = GREATEST(0, stock - ?) WHERE id = ?',
        [sh.quantity, sh.itemId]
      );
    }

    await connection.commit();
    res.json({ success: true, history: sh });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// ==================== 12. ACTIVITIES ROUTE ====================

app.get('/api/activities', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM activities ORDER BY date DESC');
    const activities = rows.map(r => ({
      id: r.id,
      title: r.title,
      type: r.type,
      executors: JSON.parse(r.executors),
      date: r.date,
      location: r.location,
      status: r.status,
      budgetTransport: parseFloat(r.budget_transport),
      budgetMeals: parseFloat(r.budget_meals),
      budgetAccommodation: parseFloat(r.budget_accommodation),
      budgetOther: parseFloat(r.budget_other),
      budgetTotal: parseFloat(r.budget_total),
      reportDescription: r.report_description || undefined,
      reportPhoto: r.report_photo || undefined
    }));
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/activities', async (req, res) => {
  try {
    const act = req.body;
    const executorsJson = JSON.stringify(act.executors);
    await pool.query(
      `INSERT INTO activities (id, title, type, executors, date, location, status, 
       budget_transport, budget_meals, budget_accommodation, budget_other, budget_total, 
       report_description, report_photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        act.id, act.title, act.type, executorsJson, act.date, act.location, act.status,
        act.budgetTransport, act.budgetMeals, act.budgetAccommodation, act.budgetOther, act.budgetTotal,
        act.reportDescription || null, act.reportPhoto || null
      ]
    );
    res.json({ success: true, activity: act });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/activities/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { status, reportDescription, reportPhoto, submitterId, submitterName } = req.body;

    // Get previous state to see if status has changed to 'disetujui'
    const [prevRows] = await connection.query('SELECT * FROM activities WHERE id = ?', [id]);
    if (prevRows.length === 0) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }
    const prevAct = prevRows[0];

    // Update query variables
    let updateFields = [];
    let updateValues = [];

    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (reportDescription !== undefined) {
      updateFields.push('report_description = ?');
      updateValues.push(reportDescription);
    }
    if (reportPhoto !== undefined) {
      updateFields.push('report_photo = ?');
      updateValues.push(reportPhoto);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await connection.query(
        `UPDATE activities SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    // Integrate with operational funds upon DPC approval
    if (status === 'disetujui' && prevAct.status !== 'disetujui' && prevAct.status !== 'pelaksanaan' && prevAct.status !== 'selesai') {
      const fundId = `f-act-${Date.now()}`;
      const executorsList = JSON.parse(prevAct.executors).map(e => `${e.name} (${e.role.toUpperCase()})`).join(', ');
      const fundTitle = `RAB Kegiatan: ${prevAct.title}`;
      const fundDesc = `Pembiayaan kegiatan [${prevAct.type}] di [${prevAct.location}]. Pelaksana: ${executorsList}`;
      const currentDate = new Date().toISOString().slice(0, 10);
      
      await connection.query(
        'INSERT INTO operational_funds (id, type, amount, category, title, description, date, submitter_id, submitter_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          fundId, 'expense', prevAct.budget_total, 'Kegiatan', fundTitle, fundDesc, currentDate,
          submitterId || 'm-0', submitterName || 'Admin DPC'
        ]
      );
    }

    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

app.delete('/api/activities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM activities WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 13. TPS MAPPING ROUTE ====================

app.get('/api/tps-mapping', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tps_mapping');
    const tpsMapping = rows.map(r => ({
      id: r.id,
      namaTps: r.nama_tps,
      kecamatan: r.kecamatan,
      desa: r.desa,
      lat: r.lat,
      lng: r.lng,
      zona: r.zona,
      dptCount: r.dpt_count,
      lastUpdatedBy: r.last_updated_by,
      lastUpdatedDate: r.last_updated_date
    }));
    res.json(tpsMapping);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tps-mapping', async (req, res) => {
  try {
    const tps = req.body;
    await pool.query(
      `INSERT INTO tps_mapping (id, nama_tps, kecamatan, desa, lat, lng, zona, dpt_count, last_updated_by, last_updated_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nama_tps = VALUES(nama_tps),
         kecamatan = VALUES(kecamatan),
         desa = VALUES(desa),
         lat = VALUES(lat),
         lng = VALUES(lng),
         zona = VALUES(zona),
         dpt_count = VALUES(dpt_count),
         last_updated_by = VALUES(last_updated_by),
         last_updated_date = VALUES(last_updated_date)`,
      [tps.id, tps.namaTps, tps.kecamatan, tps.desa, tps.lat, tps.lng, tps.zona, tps.dptCount, tps.lastUpdatedBy, tps.lastUpdatedDate]
    );
    res.json({ success: true, tpsMapping: tps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tps-mapping/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { zona, lastUpdatedBy, lastUpdatedDate } = req.body;
    await pool.query(
      'UPDATE tps_mapping SET zona = ?, last_updated_by = ?, last_updated_date = ? WHERE id = ?',
      [zona, lastUpdatedBy, lastUpdatedDate, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tps-mapping/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tps_mapping WHERE id = ?', [id]);
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

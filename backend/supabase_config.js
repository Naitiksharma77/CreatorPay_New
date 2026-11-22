require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const seedCreators = [
  {
    id: "creator_1",
    name: "Aayushi",
    category: "Lifestyle & Content",
    bio: "Love good conversations, new experiences and meeting interesting people.",
    price: 49,
    creator_age: "23",
    creator_location: "Delhi, India",
    profile_image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80",
    created_at: new Date(Date.now() - 86400000 * 5).toISOString()
  },
  {
    id: "creator_2",
    name: "Priya Sharma",
    category: "UI/UX & Product Design",
    bio: "Lead Product Designer. Great conversations on design, tech, and creative ideas.",
    price: 99,
    creator_age: "26",
    creator_location: "Bengaluru, India",
    profile_image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80",
    created_at: new Date(Date.now() - 86400000 * 4).toISOString()
  },
  {
    id: "creator_3",
    name: "Rohan Verma",
    category: "Startup Growth & Tech",
    bio: "Tech enthusiast and builder. Passionate about AI, podcasts, and deep conversations.",
    price: 149,
    creator_age: "28",
    creator_location: "Hyderabad, India",
    profile_image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80",
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: "creator_4",
    name: "Ananya Sen",
    category: "Conversations & Mentorship",
    bio: "Warm, empathetic listener. Looking to connect, share life stories, and guide people.",
    price: 49,
    creator_age: "24",
    creator_location: "Kolkata, India",
    profile_image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: "creator_5",
    name: "Kabir Malhotra",
    category: "Tech & Coding",
    bio: "Software developer into indie hacking, coffee, gaming, and curious minds.",
    price: 99,
    creator_age: "27",
    creator_location: "Pune, India",
    profile_image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80",
    created_at: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: "creator_6",
    name: "Sneha Patel",
    category: "Lifestyle & Travel",
    bio: "Travel lover, foodie, and storyteller. Always excited to meet new friends.",
    price: 49,
    creator_age: "25",
    creator_location: "Mumbai, India",
    profile_image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80",
    created_at: new Date().toISOString()
  }
];

function createMockClient() {
  const tables = {
    creators: [...seedCreators],
    users: [],
    subscriptions: [],
    subscription_payments: [],
    webhook_events: [],
    interaction_sessions: [],
    bookings: [],
    payments: [],
    messages: []
  };
  const inMemoryImages = new Map();

  class MockQueryBuilder {
    constructor(table) {
      this.table = table;
      if (!tables[table]) {
        tables[table] = [];
      }
      this.filters = [];
      this.orderField = null;
      this.orderAscending = true;
      this.limitCount = null;
      this.isSingle = false;
      this.operation = "select";
      this.payload = null;
      this.upsertOptions = null;
    }

    select() {
      return this;
    }

    order(field, { ascending = true } = {}) {
      this.orderField = field;
      this.orderAscending = ascending;
      return this;
    }

    eq(field, value) {
      this.filters.push({ field, value: String(value) });
      return this;
    }

    limit(n) {
      this.limitCount = n;
      return this;
    }

    single() {
      this.isSingle = true;
      return this;
    }

    maybeSingle() {
      this.isSingle = true;
      return this;
    }

    insert(rows) {
      this.operation = "insert";
      this.payload = Array.isArray(rows) ? rows : [rows];
      return this;
    }

    upsert(rows, options = {}) {
      this.operation = "upsert";
      this.payload = Array.isArray(rows) ? rows : [rows];
      this.upsertOptions = options;
      return this;
    }

    update(fields) {
      this.operation = "update";
      this.payload = fields;
      return this;
    }

    delete() {
      this.operation = "delete";
      return this;
    }

    execute() {
      const store = tables[this.table] || [];

      if (this.operation === "insert") {
        const inserted = [];
        for (const row of this.payload) {
          const item = {
            id: row.id || `${this.table}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            created_at: row.created_at || new Date().toISOString(),
            ...row
          };
          store.unshift(item);
          inserted.push(item);
        }
        return {
          data: this.isSingle ? inserted[0] || null : inserted,
          error: null
        };
      }

      if (this.operation === "upsert") {
        const conflictKey = (this.upsertOptions && this.upsertOptions.onConflict) || "id";
        const upserted = [];
        for (const row of this.payload) {
          const idx = row[conflictKey] !== undefined
            ? store.findIndex((existing) => String(existing[conflictKey]) === String(row[conflictKey]))
            : -1;
          if (idx !== -1) {
            store[idx] = { ...store[idx], ...row };
            upserted.push(store[idx]);
          } else {
            const item = {
              id: row.id || `${this.table}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              created_at: row.created_at || new Date().toISOString(),
              ...row
            };
            store.unshift(item);
            upserted.push(item);
          }
        }
        return {
          data: this.isSingle ? upserted[0] || null : upserted,
          error: null
        };
      }

      if (this.operation === "update") {
        const updatedItems = [];
        for (let i = 0; i < store.length; i++) {
          const item = store[i];
          const matches = this.filters.every((f) => String(item[f.field]) === f.value);
          if (matches) {
            store[i] = { ...item, ...this.payload };
            updatedItems.push(store[i]);
          }
        }
        return {
          data: this.isSingle ? (updatedItems[0] || null) : updatedItems,
          error: updatedItems.length > 0 ? null : { message: "Item not found" }
        };
      }

      if (this.operation === "delete") {
        let deletedItem = null;
        const index = store.findIndex((item) =>
          this.filters.every((f) => String(item[f.field]) === f.value)
        );
        if (index !== -1) {
          deletedItem = store.splice(index, 1)[0];
        }
        return {
          data: this.isSingle ? deletedItem : (deletedItem ? [deletedItem] : []),
          error: deletedItem ? null : { message: "Item not found" }
        };
      }

      let results = [...store];

      for (const filter of this.filters) {
        results = results.filter((item) => String(item[filter.field]) === filter.value);
      }

      if (this.orderField) {
        results.sort((a, b) => {
          const valA = a[this.orderField] || "";
          const valB = b[this.orderField] || "";
          if (valA < valB) return this.orderAscending ? -1 : 1;
          if (valA > valB) return this.orderAscending ? 1 : -1;
          return 0;
        });
      }

      if (this.limitCount !== null) {
        results = results.slice(0, this.limitCount);
      }

      if (this.isSingle) {
        return {
          data: results.length > 0 ? results[0] : null,
          error: results.length > 0 ? null : { message: "Item not found" }
        };
      }

      return {
        data: results,
        error: null
      };
    }

    then(resolve, reject) {
      try {
        resolve(this.execute());
      } catch (err) {
        reject(err);
      }
    }
  }

  return {
    from: (table) => new MockQueryBuilder(table),
    storage: {
      from: () => ({
        upload: async (fileName, buffer, options = {}) => {
          try {
            const mime = options.contentType || "image/jpeg";
            const base64 = Buffer.isBuffer(buffer)
              ? buffer.toString("base64")
              : Buffer.from(buffer).toString("base64");
            inMemoryImages.set(fileName, `data:${mime};base64,${base64}`);
            return { data: { path: fileName }, error: null };
          } catch (err) {
            return { data: null, error: err };
          }
        },
        getPublicUrl: (fileName) => {
          const url = inMemoryImages.get(fileName) || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80";
          return { data: { publicUrl: url } };
        }
      })
    }
  };
}

let supabaseClient;
let isSupabaseLive = false;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseUrl.startsWith("http") && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    isSupabaseLive = true;
  } catch (err) {
    console.warn("[Takora] Supabase init failed, using fallback:", err.message);
    supabaseClient = createMockClient();
  }
} else {
  console.log("[Takora] Running with fallback database client.");
  supabaseClient = createMockClient();
}

supabaseClient.isSupabaseLive = isSupabaseLive;

module.exports = supabaseClient;
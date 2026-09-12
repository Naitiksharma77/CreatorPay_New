const supabase = require("./supabase_config");

async function testSupabase() {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Supabase connection failed:");
    console.error(error);
    return;
  }

  console.log("Supabase connection successful!");
  console.log("Creators data:", data);
}

testSupabase();
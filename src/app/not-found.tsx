"use client";

import NotFoundLayout from "./components/NotFoundLayout";

export default function NotFound() {
  return <NotFoundLayout />;
}

// import { useEffect, useState } from "react"
// import { supabase } from "@/app/utils/supabase/client";

// export default function NotFound() {
//   const [data, setData] = useState<any[]>([])

//   useEffect(() => {
//     const fetchData = async () => {
//       const { data, error } = await supabase
//         .from("topics")
//         .select("*")

//       if (error) console.error(error)
//       else setData(data)
//     }

//     fetchData()
//   }, [])

//   return (
//     <div>
//       <h1>Users</h1>
//       <pre>{JSON.stringify(data, null, 2)}</pre>
//     </div>
//   )
// }
export const SAMPLE_PATCH = `diff --git a/src/greeting.ts b/src/greeting.ts
index 87ab12d..41ef982 100644
--- a/src/greeting.ts
+++ b/src/greeting.ts
@@ -1,8 +1,12 @@
-export function greeting(name: string) {
-  return \`Hello, \${name}.\`
+export function greeting(name: string) {
+  const normalized = name.trim()
+
+  return \`Hello, \${normalized}!\`
 }
 
-export function farewell(name: string) {
-  return \`Goodbye, \${name}.\`
+export function farewell(name: string, formal = false) {
+  if (formal) {
+    return \`Goodbye, \${name}.\`
+  }
+  return \`See you later, \${name}.\`
 }
diff --git a/src/index.ts b/src/index.ts
index 5ca1d77..cc43c91 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,9 @@
 import { greeting } from "./greeting"
 
-console.log(greeting("OpenTUI"))
+const name = process.argv[2] ?? "OpenTUI"
+
+console.log(greeting(name))
+console.log("Diffs are now visible in the terminal.")
`

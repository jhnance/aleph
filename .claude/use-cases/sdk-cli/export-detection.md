# Export Detection

The CLI statically analyzes the codebase to detect named exports from a point. Detected exports are reconciled against the previous version's export manifest to identify new exports, removed exports, and potential renames. Design of the static analysis approach (AST, tree-sitter, tsc compiler API) to be elaborated.

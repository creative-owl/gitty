# Homebrew

The release workflow renders a Homebrew formula from the release checksums.

To publish the formula automatically, create a `creative-owl/homebrew-c8o` tap with a `Formula/`
directory and configure the `HOMEBREW_TAP_TOKEN` repository secret with write access to that tap.

Tagged releases upload `gitty.rb` as a release asset and push the same file to:

```text
creative-owl/homebrew-c8o/Formula/gitty.rb
```

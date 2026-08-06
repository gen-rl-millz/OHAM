# Homebrew formula for OHAM — install: brew install gen-rl-millz/oham/oham
# (tap repo: gen-rl-millz/homebrew-oham, containing this file as Formula/oham.rb)
class Oham < Formula
  desc "OHAM — OrthoHolonic Accessible Memory: exact reader for .tsb sealed media"
  homepage "https://github.com/gen-rl-millz/oham"
  version "0.2.0"
  license "Apache-2.0 WITH Commons-Clause"

  on_linux do
    url "https://github.com/gen-rl-millz/oham/releases/download/v0.2.0/oham-v0.2.0-linux-x86_64.tar.gz"
    sha256 "RELEASE_SHA256_LINUX"   # filled from RELEASE_SHA256SUMS at release time
  end
  # on_macos blocks land when darwin binaries exist (see STATUS.md)

  def install
    bin.install "oham"
  end

  test do
    assert_match "OrthoHolonic", shell_output("#{bin}/oham about")
  end
end

# ── ToucanRoyale ──────────────────────────────────────────────────────────────

toucan-all:
	ENV=ToucanRoyale npm test

toucan-smoke:
	ENV=ToucanRoyale npm run test:smoke

toucan-spin:
	ENV=ToucanRoyale npm run test:spin

toucan-bet:
	ENV=ToucanRoyale npm run test:bet

toucan-autoplay:
	ENV=ToucanRoyale npm run test:autoplay

toucan-turbo:
	ENV=ToucanRoyale npm run test:turbo

toucan-api:
	ENV=ToucanRoyale npm run test:api

toucan-payout:
	ENV=ToucanRoyale npm run test:payout

toucan-endurance:
	ENV=ToucanRoyale npm run test:endurance

toucan-rng:
	ENV=ToucanRoyale npm run test:rng

toucan-edge:
	ENV=ToucanRoyale npm run test:edge

toucan-bonus:
	ENV=ToucanRoyale npm run test:bonus

toucan-responsive:
	ENV=ToucanRoyale npm run test:responsive

toucan-network:
	ENV=ToucanRoyale npm run test:network

toucan-session:
	ENV=ToucanRoyale npm run test:session

toucan-social:
	ENV=ToucanRoyale npm run test:social

toucan-social-dom:
	ENV=ToucanRoyale npm run test:social-dom

toucan-social-ocr:
	ENV=ToucanRoyale npm run test:social-ocr

toucan-fast:
	ENV=ToucanRoyale npm run test:fast







# ── NovomaticGames ────────────────────────────────────────────────────────────

novomatic-all:
	ENV=NovomaticGames npm test

novomatic-smoke:
	ENV=NovomaticGames npm run test:smoke

novomatic-spin:
	ENV=NovomaticGames npm run test:spin

novomatic-bet:
	ENV=NovomaticGames npm run test:bet

novomatic-autoplay:
	ENV=NovomaticGames npm run test:autoplay

novomatic-turbo:
	ENV=NovomaticGames npm run test:turbo

novomatic-api:
	ENV=NovomaticGames npm run test:api

novomatic-payout:
	ENV=NovomaticGames npm run test:payout

novomatic-endurance:
	ENV=NovomaticGames npm run test:endurance

novomatic-rng:
	ENV=NovomaticGames npm run test:rng

novomatic-edge:
	ENV=NovomaticGames npm run test:edge

novomatic-bonus:
	ENV=NovomaticGames npm run test:bonus

novomatic-responsive:
	ENV=NovomaticGames npm run test:responsive

novomatic-network:
	ENV=NovomaticGames npm run test:network

novomatic-session:
	ENV=NovomaticGames npm run test:session

novomatic-social:
	ENV=NovomaticGames npm run test:social

novomatic-social-dom:
	ENV=NovomaticGames npm run test:social-dom

novomatic-social-ocr:
	ENV=NovomaticGames npm run test:social-ocr

novomatic-fast:
	ENV=NovomaticGames npm run test:fast


# ── Utilities ─────────────────────────────────────────────────────────────────

report:
	npm run report
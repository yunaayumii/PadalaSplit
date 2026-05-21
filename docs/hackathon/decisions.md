# Hackathon Decision Framework

Project context: Build on Stellar Philippines Hackathon 2026  
Theme: real-world financial solutions for Filipinos  
Goal: ship a working MVP with clear Stellar integration, strong user value, and a demo-ready story.

## Decision Principles

Use these principles whenever the team needs to choose between ideas, features, designs, or technical approaches.

## 1. Optimize for a Finished MVP

The best hackathon project is not the biggest idea. It is the most complete, understandable, and demonstrable version of a useful idea.

Choose work that helps us reach:
- A working app or website
- A live Stellar Testnet flow
- A clear user journey
- A demo that works in 3-5 minutes
- Screenshots for Testnet and Mainnet submission requirements

Avoid features that are impressive but risky if they weaken the core demo.

## 2. Choose a Real Filipino Financial Problem

Every major decision should answer this question:

**Does this help a real Filipino user move, access, manage, or grow money better?**

Preferred users:
- OFWs sending money home
- MSMEs managing payments and cashflow
- Unbanked or underbanked communities
- Freelancers receiving cross-border payments
- Barangays, NGOs, or cooperatives distributing funds

If a feature does not clearly help one of these users, it should probably be cut.

## 3. Make Stellar Essential

The project should not feel like a normal finance app with blockchain added at the end.

Stellar should be visible in the core workflow through:
- Testnet or Mainnet payments
- Stablecoin or custom asset transfers
- Wallet connection
- Transaction hashes
- Stellar Expert links
- Low-cost, fast settlement
- Optional Soroban smart contract logic

Good test: if we remove Stellar, does the product lose something important? If not, the idea needs a stronger Stellar angle.

## 4. Score Ideas Against Judging Criteria

Use the official judging weights to compare ideas:

| Criteria | Weight | What We Should Ask |
|---|---:|---|
| Real-World Impact | 30% | Is the problem urgent and easy to understand? |
| Technical Execution on Stellar | 25% | Is Stellar used meaningfully in the working product? |
| UX / Usability | 20% | Can a first-time user complete the main flow easily? |
| Innovation | 15% | Is there a fresh angle beyond a basic wallet? |
| Feasibility | 10% | Can we finish and polish this before demo day? |

Total score should guide decisions, but feasibility is a hard gate. A high-impact idea that cannot be finished should not be chosen.

## 5. Prefer One Strong Workflow

The MVP should focus on one primary flow and make it excellent.

Examples:
- Merchant creates invoice, customer pays, invoice becomes paid.
- OFW sends funds, app splits money into family buckets.
- Admin sends aid, recipients receive funds, public audit page updates.

Do not build many disconnected features. Judges should understand the product after seeing one complete transaction.

## 6. Demo First, Architecture Second

Technical choices should support a reliable demo.

Prefer:
- Simple architecture
- Few dependencies
- Fast local setup
- Clear transaction state
- Reliable test accounts
- Seed data for demos
- Error states that explain what went wrong

Avoid:
- Overbuilt smart contracts
- Complex auth unless needed
- Too many user roles
- Features that depend on unstable external services
- Backend complexity that does not improve the demo

## 7. Cut Scope Aggressively

Use three scope levels:

**Must Have**
- Required for the main demo flow
- Required for Stellar integration
- Required for submission completeness

**Should Have**
- Improves judging score
- Makes the app easier to understand
- Can be finished after must-haves

**Could Have**
- Nice polish
- Pitch-friendly but not necessary
- Cut immediately if time is tight

If a feature is not part of the demo script, it is not a must-have.

## 8. Design for Trust

Financial products need clarity and confidence.

The app should show:
- Who is sending or receiving money
- Amounts and currency
- Payment status
- Transaction hash or explorer link
- Clear success and failure messages
- Simple language, not crypto jargon

Users should not need to understand blockchain to understand what happened.

## 9. Build for the Submission Checklist

Do not leave submission requirements until the end.

Track these from day one:
- Clean GitHub repository
- Complete README
- Working MVP
- Stellar Testnet screenshot
- Stellar Mainnet screenshot
- Demo video, 2-3 minutes
- Pitch deck, max 10 slides

Each major technical milestone should produce something useful for the final submission.

## 10. Decide With a Small Matrix

When comparing ideas or big features, score each from 1 to 5.

| Option | Impact | Stellar Fit | UX Clarity | Innovation | Feasibility | Total |
|---|---:|---:|---:|---:|---:|---:|
| Option A |  |  |  |  |  |  |
| Option B |  |  |  |  |  |  |
| Option C |  |  |  |  |  |  |

Suggested weighted formula:

```text
Total = Impact * 0.30
      + Stellar Fit * 0.25
      + UX Clarity * 0.20
      + Innovation * 0.15
      + Feasibility * 0.10
```

Rule: any option with feasibility below 3 should be rejected or simplified.

## Recommended Product Decision

Based on the hackathon theme and judging criteria, the strongest default choice is:

**MSME Stablecoin Invoice Pay**

Why:
- Clear real-world problem for Filipino MSMEs
- Simple 3-5 minute demo
- Stellar payment integration is central
- Easy to show transaction proof
- Strong UX potential
- Feasible within hackathon time

Primary demo flow:
1. Merchant creates an invoice.
2. App generates a Stellar payment request.
3. Customer pays through Stellar.
4. Invoice changes from unpaid to paid.
5. Merchant sees transaction proof and cashflow summary.

## Final Decision Rule

When unsure, choose the option that makes the final demo clearer, more reliable, and more obviously useful to a real Filipino user.

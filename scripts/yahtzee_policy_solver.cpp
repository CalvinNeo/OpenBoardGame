// Offline numeric kernel for build_yahtzee_policy.py. All dice transitions,
// scores and Joker restrictions are supplied by the Python game engine.
// No compiler or native library is required by the running game server.
#include <algorithm>
#include <array>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <vector>

constexpr int BOXES = 13;
constexpr int MASKS = 1 << BOXES;
constexpr int YAHTZEE = 1 << 11;
constexpr int ROLLS = 252;
constexpr int PARTIAL = 210;
constexpr int HANDS = PARTIAL + ROLLS;

int read_int(std::istream& input) {
    int value;
    if (!(input >> value)) throw std::runtime_error("Incomplete solver input");
    return value;
}

int index_of(int mask, int upper, int bonus) {
    return (mask * 64 + upper) * 2 + bonus;
}

struct Joker {
    int allowed;
    std::array<int, BOXES> scores;
};

void expectations(std::array<double, HANDS>& values,
                  const std::array<std::array<int, 6>, PARTIAL>& children) {
    for (int hand = PARTIAL - 1; hand >= 0; --hand) {
        double sum = 0;
        for (int child : children[hand]) sum += values[child];
        values[hand] = sum / 6.0;
    }
}

int main(int argc, char** argv) {
    try {
        if (argc != 3) throw std::runtime_error("Usage: solver INPUT OUTPUT");
        std::ifstream input(argv[1]);
        std::array<std::array<int, 6>, PARTIAL> children;
        std::array<std::vector<int>, ROLLS> keeps;
        std::array<std::array<int, BOXES>, ROLLS> points;
        std::array<int, ROLLS> yahtzee_face;
        for (auto& hand : children) for (int& child : hand) child = read_int(input);
        for (auto& hand : keeps) {
            int size = read_int(input);
            for (int i = 0; i < size; ++i) hand.push_back(read_int(input));
        }
        for (auto& roll : points) for (int& score : roll) score = read_int(input);
        for (int& face : yahtzee_face) face = read_int(input);
        std::vector<std::array<Joker, 6>> jokers(MASKS);
        for (int mask = 1; mask < MASKS; ++mask) {
            if (mask & YAHTZEE) continue;
            for (auto& joker : jokers[mask]) {
                joker.allowed = read_int(input);
                for (int& score : joker.scores) score = read_int(input);
            }
        }

        // Keep double precision through the entire solve; round only for export.
        std::vector<double> table(MASKS * 64 * 2, 0.0);
        for (int mask = 1; mask < MASKS; ++mask) {
            std::vector<int> open;
            int max_upper = 0;
            for (int cat = 0; cat < BOXES; ++cat) {
                if (mask & (1 << cat)) {
                    open.push_back(cat);
                    if (cat < 6) max_upper += 5 * (cat + 1);
                }
            }
            for (int upper = 0; upper < 64; ++upper) {
                for (int bonus = 0; bonus <= (mask & YAHTZEE ? 0 : 1); ++bonus) {
                    // If the upper bonus is unreachable, the subtotal is irrelevant.
                    if (upper > 0 && upper + max_upper < 63) {
                        table[index_of(mask, upper, bonus)] = table[index_of(mask, 0, bonus)];
                        continue;
                    }
                    std::array<double, HANDS> values{};
                    for (int roll = 0; roll < ROLLS; ++roll) {
                        const bool joker_active = bonus && yahtzee_face[roll] >= 0;
                        const Joker* joker = joker_active ? &jokers[mask][yahtzee_face[roll]] : nullptr;
                        double best = -1.0;
                        for (int cat : open) {
                            if (joker && !(joker->allowed & (1 << cat))) continue;
                            int score = joker ? joker->scores[cat] : points[roll][cat];
                            int next_upper = std::min(63, upper + (cat < 6 ? score : 0));
                            int next_bonus = bonus || (cat == 11 && score == 50);
                            int reward = score + (joker ? 100 : 0)
                                + (upper < 63 && next_upper == 63 ? 35 : 0);
                            best = std::max(best, reward + table[index_of(mask ^ (1 << cat), next_upper, next_bonus)]);
                        }
                        values[PARTIAL + roll] = best;
                    }
                    for (int reroll = 0; reroll < 2; ++reroll) {
                        expectations(values, children);
                        // Store separately: all keeps refer to the previous layer.
                        std::array<double, ROLLS> next{};
                        for (int roll = 0; roll < ROLLS; ++roll) {
                            for (int keep : keeps[roll]) next[roll] = std::max(next[roll], values[keep]);
                        }
                        std::copy(next.begin(), next.end(), values.begin() + PARTIAL);
                    }
                    expectations(values, children);
                    table[index_of(mask, upper, bonus)] = values[0];
                }
                // The bonus flag cannot be active while the Yahtzee box is open.
                if (mask & YAHTZEE) table[index_of(mask, upper, 1)] = table[index_of(mask, upper, 0)];
            }
            if (mask % 1024 == 0) std::cerr << "Solved " << mask << " / " << MASKS - 1 << " masks\n";
        }
        std::ofstream output(argv[2], std::ios::binary);
        if (!output) throw std::runtime_error("Cannot open solver output");
        for (double value : table) {
            float packed = static_cast<float>(value);
            output.write(reinterpret_cast<const char*>(&packed), sizeof(packed));
        }
        if (!output) throw std::runtime_error("Cannot write solver output");
        std::cout.precision(12);
        std::cout << "Opening expected score: " << table[index_of(MASKS - 1, 0, 0)] << '\n';
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}

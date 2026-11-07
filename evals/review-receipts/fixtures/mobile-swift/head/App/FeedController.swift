import UIKit

final class FeedController: UIViewController {
    private var refreshTimer: Timer?
    private var items: [String] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
            self.reload()
        }
    }

    deinit {
        refreshTimer?.invalidate()
    }

    private func reload() {
        items.append("item")
    }
}

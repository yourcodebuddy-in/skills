import UIKit

final class ProfileController: UIViewController {
    private var refreshTimer: Timer?
    private var name = ""

    override func viewDidLoad() {
        super.viewDidLoad()
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.reload()
        }
    }

    deinit {
        refreshTimer?.invalidate()
    }

    private func reload() {
        name = "updated"
    }
}

"""The map's individual, editable landmarks, keyed by their web asset IDs."""
import importlib

import bridge
import civic
import gardens
import suspension
import tower

for module in (bridge, civic, gardens, suspension, tower):
    importlib.reload(module)

BUILDERS = {
    "tower": tower.build, "bridge": bridge.build, "qc": gardens.qc, "tv": civic.tv,
    "customs": civic.customs, "wuda": civic.wuda, "lake": gardens.lake,
    "chutian": gardens.chutian, "hongshan": gardens.hongshan, "watertower": civic.watertower,
    "museum": civic.museum, "honglou": civic.honglou, "yingwuzhou": suspension.build,
    "guiyuan": gardens.guiyuan, "qintai": gardens.qintai,
}

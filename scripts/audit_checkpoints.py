import os
import glob
import torch

checkpoints = [
    'ai-service/models/unet_resnet34_pre_post.pth',
    'ai-service/models/unet_resnet34_post_only.pth',
    'ai-service/models/stage1_building_loc_best.pth',
    'ai-service/models/stage2_damage_clf_best.pth',
    'models/india_v1/best_model.pth',
    'models/india_v2/best_model.pth',
    'models/india_v3/stage1/best_model.pt',
    'models/india_v3/stage2/best_model.pt',
]

print("=" * 80)
print("CHECKPOINT WEIGHT AUDIT")
print("=" * 80)

for ckpt in checkpoints:
    if not os.path.exists(ckpt):
        print(f"{ckpt:45s} | NOT FOUND")
        continue
    data = torch.load(ckpt, map_location='cpu', weights_only=False)
    extra = "raw state_dict"
    if isinstance(data, dict):
        if 'model_state_dict' in data:
            state = data['model_state_dict']
            vl = data.get('val_loss', 'N/A')
            vl_str = f"{vl:.4f}" if isinstance(vl, float) else str(vl)
            extra = f"epoch={data.get('epoch', '?')}, val_loss={vl_str}"
        elif 'state_dict' in data:
            state = data['state_dict']
            extra = "state_dict"
        else:
            state = data
    else:
        state = data.state_dict()
        extra = "model obj"
    
    num_tensors = len(state)
    total_weights = sum(p.numel() for p in state.values() if isinstance(p, torch.Tensor))
    first_key = list(state.keys())[0]
    last_key = list(state.keys())[-1]
    first_w = state[first_key]
    last_w = state[last_key]
    print(f"{ckpt:46s} | {extra:25s} | tensors={num_tensors:3d} | params={total_weights:,}")
    print(f"   -> {first_key}: shape={list(first_w.shape)}, mean={first_w.float().mean():.4e}, std={first_w.float().std():.4e}")
    print(f"   -> {last_key}: shape={list(last_w.shape)}, mean={last_w.float().mean():.4e}, std={last_w.float().std():.4e}")

import torch

print(f"PyTorch Version: {torch.__version__}")
print(f"CUDA Available:  {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"Device Name:     {torch.cuda.get_device_name(0)}")
    x = torch.randn(100, 100, device="cuda")
    print(f"Tensor on CUDA:  {x.device}")

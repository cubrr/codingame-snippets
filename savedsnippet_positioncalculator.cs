static class Calculator
{
    public static List<int> GetAcceleratingPositions(int initialIndex, int initialSpeed, int count)
    {
        var list = new List<int>{ initialIndex };
        int speed = initialSpeed + 1;
        for (int i = 1; i < count; i++)
        {
            int index = list[i - 1] + speed++;
            list.Add(index);
        }
        return list;
    }
    
    public static List<int> GetDecceleratingPositions(int initialIndex, int initialSpeed, int count)
    {
        var list = new List<int>{ initialIndex };
        int speed = initialSpeed - 1;
        for (int i = 1; i < count; i++)
        {
            int index = list[i - 1] + speed--;
            list.Add(index);
        }
        return list;
    }
}
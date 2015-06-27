using System;
using System.Linq;
using System.IO;
using System.Text;
using System.Collections;
using System.Collections.Generic;

static class Extensions
{
    public static double ToDegrees(this double d)
    {
        return (180 / Math.PI) * d;
    }

    public static int MapToRange(this int x, int in_min, int in_max, int out_min, int out_max)
    {
        return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    }

    public static double MapToRange(this double x, double in_min, double in_max, double out_min, double out_max)
    {
        return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    }
}

class Vector2D : IEquatable<Vector2D>
{
    public int X { get; private set; }
    public int Y { get; private set; }

    public Vector2D(int x, int y)
    {
        X = x;
        Y = y;
    }

    public double AngleTo(Vector2D other)
    {
        int adjacent = Math.Abs(X - other.X);
        int opposite = Math.Abs(Y - other.Y);
        if (adjacent == 0)
            return 0;
        return Math.Atan(opposite / adjacent).ToDegrees();
    }

    #region Operators

    public static Vector2D operator +(Vector2D left, Vector2D right)
    {
        return new Vector2D(left.X + right.X, left.Y + right.Y);
    }

    public static Vector2D operator -(Vector2D left, Vector2D right)
    {
        return new Vector2D(left.X - right.X, left.Y - right.Y);
    }

    public static bool operator ==(Vector2D left, Vector2D right)
    {
        return !ReferenceEquals(left, null) && left.Equals(right);
    }

    public static bool operator !=(Vector2D left, Vector2D right)
    {
        return !(left == right);
    }

    #endregion

    #region Overrides & interface implementations

    public bool Equals(Vector2D other)
    {
        if (ReferenceEquals(other, null))
            return false;
        return  X == other.X &&
            Y == other.Y;
    }

    public override bool Equals(object obj)
    {
        var other = obj as Vector2D;
        if (ReferenceEquals(other, null))
            return false;
        return this.Equals(other);
    }

    public override int GetHashCode()
    {
        return new {A = X, B = Y}.GetHashCode();
    }

    #endregion
}

class Planet
{
    private List<Vector2D> surfaceVector2Ds;
    public double Gravity { get; private set; }
    public Vector2D LandingZoneBegin { get; private set; }
    public Vector2D LandingZoneCenter
    {
        get
        {
            return new Vector2D((LandingZoneEnd.X + LandingZoneBegin.X) / 2,
                LandingZoneEnd.Y);
        }
    }
    public Vector2D LandingZoneEnd { get; private set; }

    public Planet(double gravity)
    {
        surfaceVector2Ds = new List<Vector2D>();
        Gravity = gravity;
    }

    // Finds the 1km landing zone
    public void FindLandingZone()
    {
        using (var enumerator = surfaceVector2Ds.GetEnumerator())
        {
            if (!enumerator.MoveNext())
                throw new Exception("surfaceVector2Ds is empty!");
            LandingZoneBegin = enumerator.Current;

            while (enumerator.MoveNext())
            {
                LandingZoneEnd = enumerator.Current;
                if (LandingZoneBegin.Y != LandingZoneEnd.Y)
                {
                    LandingZoneBegin = LandingZoneEnd;
                    continue;
                }
                if (LandingZoneEnd.X - LandingZoneBegin.X >= 1000)
                {
                    break;
                }
            }
        }
    }

    public void InitializeFromConsole(int pairs)
    {
        while (pairs-- > 0)
        {
            string[] input = Console.ReadLine().Split(' ');
            surfaceVector2Ds.Add(new Vector2D(Int32.Parse(input[0]), Int32.Parse(input[1])));
        }
    }
}

class Lander
{
    static readonly Vector2D SpeedLimits = new Vector2D(20, 40);

    private Planet planet;

    private double CenterRange
    {
        get
        {
            return (planet.LandingZoneEnd.X - planet.LandingZoneBegin.X) * 0.025; // 2.5% range
        }
    }

    /// <summary>
    /// Returns a direction depicting which half of the landing
    /// zone we currently are on
    /// </summary>
    private Direction LandingZoneSide
    {
        get
        {
            int lzBeginX = planet.LandingZoneBegin.X;
            int lzEndX = planet.LandingZoneEnd.X;
            int lzCenter = planet.LandingZoneCenter.X;
            // 2.5% +- center coord
            if (InsideRange(Position.X, (int)(lzCenter - (CenterRange / 2)), (int)(lzCenter + (CenterRange / 2))))
                return Direction.Center;
            if (Position.X < lzCenter)
                return Direction.Left;
            return Direction.Right;
        }
    }

    private bool OverLandingZone
    {
        get
        {
            return  Position.X >= planet.LandingZoneBegin.X &&
                Position.X <= planet.LandingZoneEnd.X;
        }
    }

    public Vector2D Position { get; private set; }

    public Vector2D Velocity { get; private set; }
    /// <summary>
    /// In litres
    /// </summary>
    public int FuelRemaining { get; private set; }
    /// <summary>
    /// In degrees. 0 means that the lander is not
    /// tilted at all and that landing gear is facing towards the land
    /// </summary>
    public int Rotation { get; private set; }

    public int CurrentThrust { get; private set; }

    private void UpdateFromConsole()
    {
        int[] data = Console.ReadLine()
            .Split(' ')
            .Select(s => Int32.Parse(s))
            .ToArray();
        Position = new Vector2D(data[0], data[1]);
        Velocity = new Vector2D(data[2], data[3]);
        FuelRemaining = data[4];
        Rotation = data[5];
        CurrentThrust = data[6];
    }

    #region AI queue population

    private bool SameSign(int a, int b)
    {
        return ((a < 0) == (b < 0));
    }

    // Cheers Kevin
    // http://stackoverflow.com/a/3188685/996081
    private bool InsideRange(int numberToCheck, int bottom, int top)
    {
        return (numberToCheck > bottom && numberToCheck < top);
    }

    private int SquishMax(int n, int max)
    {
        return n > max ? max : n;
    }

    private int SquishMin(int n, int min)
    {
        return n < min ? min : n;
    }

    bool finalDecelerationInProgress = false;
    // CALCULATE FLIGHT PATH TO CENTER OF LZ
    // AND FILL AI DECISION QUEUE WITH STEPS
    private void OutputDecision()
    {
        // Target is the center (center by X) of the LZ
        var target = new Vector2D(planet.LandingZoneCenter.X - 250, Position.Y - Velocity.Y);
        // TARGET MUST ALWAYS BE FIRST IN STDERROR
        Console.Error.WriteLine("TARGET:" + target.X + "," + target.Y);

        int distToTarget = Position.X - target.X;
        int angle = 0;
        const int rangeOfSuperBoost = 1000;
        Console.Error.WriteLine("Dist to target: " + distToTarget);

        if (distToTarget >= 0)
        {
            int temp = distToTarget > rangeOfSuperBoost ? distToTarget : rangeOfSuperBoost;
            Console.Error.WriteLine("temp: " + temp);
            angle = distToTarget.MapToRange(0, temp, 0, 90);
        }
        else
        {
            int temp = distToTarget < -rangeOfSuperBoost ? distToTarget : -rangeOfSuperBoost;
            Console.Error.WriteLine("temp: " + temp);
            angle = distToTarget.MapToRange(temp, 0, -90, 0);
        }

        double absDist = Math.Abs(distToTarget);
        double absLimit = 250 + Math.Abs(Velocity.X);
        if (absDist < absLimit)
        {
            angle += (int)(Velocity.X * 2.5);
        }

        int thrust = 2;
        CurrentThrust = SquishMin(CurrentThrust, 1);
        // d = (vi^2 - vf^2) / 2 * a
        // if our current thrust's deceleration range is more than our distance to grnd,
        // increase thrust.
        int minDecelerationDistance =
            (int)((Math.Pow(Velocity.Y, 2) - Math.Pow(-SpeedLimits.Y, 2)) / (4 - planet.Gravity));
        Console.Error.WriteLine("Deceldist at " + CurrentThrust + "m/s: " + minDecelerationDistance);

        if (minDecelerationDistance > Position.Y)
        {
            thrust = 4;
            finalDecelerationInProgress = true;
        }

        Console.WriteLine(angle + " " + (finalDecelerationInProgress ? 4 : 2));

        // TODO: Offset the target by the velocity
        Console.Error.WriteLine("Deceltime at 4m/s: " + (Velocity.Y / -4d));
        Console.Error.WriteLine("Angle to target: " + Position.AngleTo(target));
    }

    #endregion

    public Lander(Planet p)
    {
        planet = p;
    }

    public void OnTick()
    {
        UpdateFromConsole();
        OutputDecision();
    }
}

class Player
{
    public static event TickHandler Tick;
    public delegate void TickHandler();

    static void Main(string[] args)
    {
        int n = Int32.Parse(Console.ReadLine()); // the number of Vector2Ds used to draw the surface of Mars.
        var planet = new Planet(3.711d);
        planet.InitializeFromConsole(n);
        planet.FindLandingZone();
        var lander = new Lander(planet);
        Tick += lander.OnTick;
        BeginLoop();
    }

    static void BeginLoop()
    {
        for (;;)
        {
            Tick();
        }
    }
}

enum Direction
{
    Left = -1,
    Center = 0,
    Right = 1
}